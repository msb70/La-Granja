import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { q, tx, audit } from './db.js';
import { login, requireAuth, requireRol, puedeGranja, granjaDeLote, ROL_NOMBRE } from './auth.js';
import { lotesConKpi, loadCatalogs, hoyCaracas, diffDias } from './kpi.js';
import { reporteLote, reporteLotes } from './reportes.js';

const api = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s || ''));

// ---------------- Autenticación ----------------
api.post('/auth/login', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return bad(res, 'Usuario y contraseña son obligatorios');
  const r = await login(username.trim(), password);
  if (!r) return bad(res, 'Usuario o contraseña incorrectos', 401);
  await audit(r.usuario.id, 'login', 'usuario', r.usuario.id);
  res.json(r);
}));

api.use(requireAuth);
api.get('/auth/me', (req, res) => res.json(req.user));

api.post('/auth/password', wrap(async (req, res) => {
  const { actual, nueva } = req.body || {};
  if (!nueva || nueva.length < 6) return bad(res, 'La nueva contraseña debe tener al menos 6 caracteres');
  const [u] = await q('SELECT password_hash FROM usuarios WHERE id=$1', [req.user.id]);
  if (!(await bcrypt.compare(actual || '', u.password_hash))) return bad(res, 'La contraseña actual no es correcta');
  await q('UPDATE usuarios SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(nueva, 10), req.user.id]);
  res.json({ ok: true });
}));

const granjasFiltro = (user) => (user.global ? null : user.granjas);

// ---------------- Bootstrap (caché offline del dispositivo) ----------------
api.get('/bootstrap', wrap(async (req, res) => {
  const cat = await loadCatalogs();
  const gf = granjasFiltro(req.user);
  const [razas, incubadoras, plantas, granjas, galpones] = await Promise.all([
    q('SELECT id, nombre, fuente, por_validar FROM razas ORDER BY nombre'),
    q('SELECT nombre FROM incubadoras ORDER BY nombre'),
    q('SELECT id, nombre FROM plantas ORDER BY nombre'),
    q(`SELECT * FROM granjas WHERE activo ${gf ? 'AND id = ANY($1)' : ''} ORDER BY nombre`, gf ? [gf] : []),
    q(`SELECT ga.* FROM galpones ga WHERE ga.activo ${gf ? 'AND ga.granja_id = ANY($1)' : ''} ORDER BY ga.granja_id, ga.numero`, gf ? [gf] : []),
  ]);
  const lotes = await lotesConKpi({ granjaIds: gf, estado: ['activo'], cat, detalle: true });
  // Para el móvil basta con los últimos 10 días de serie
  for (const l of lotes) { l.pesajes = l.dias.filter(d => d.peso_g != null).map(d => ({ dia: d.dia, peso_g: d.peso_g, peso_std_g: d.peso_std_g })); l.dias = l.dias.slice(-10); delete l.semanas; delete l.despachos; }
  res.json({
    usuario: req.user, config: cat.config, estandares: cat.estandares, razas, incubadoras: incubadoras.map(i => i.nombre), plantas,
    granjas, galpones, lotes, hoy: hoyCaracas(), generado_en: new Date().toISOString(),
  });
}));

// ---------------- Lotes ----------------
api.get('/lotes', wrap(async (req, res) => {
  const estado = req.query.estado ? String(req.query.estado).split(',') : null;
  res.json(await lotesConKpi({ granjaIds: granjasFiltro(req.user), estado }));
}));

api.get('/lotes/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const g = await granjaDeLote(id);
  if (!g) return bad(res, 'Lote no encontrado', 404);
  if (!puedeGranja(req.user, g.granja_id)) return bad(res, 'Sin acceso a esta granja', 403);
  const [lote] = await lotesConKpi({ ids: [id], detalle: true });
  const [capturas, fotos, discrepancias, validaciones] = await Promise.all([
    q(`SELECT c.*, c.fecha::text AS fecha, u.nombre AS usuario FROM capturas c LEFT JOIN usuarios u ON u.id=c.usuario_id
       WHERE lote_id=$1 ORDER BY c.fecha DESC, c.capturado_en DESC LIMIT 400`, [id]),
    q("SELECT id, captura_id, ref_tipo, ref_id, mime, creado_en FROM fotos WHERE lote_id=$1 ORDER BY creado_en", [id]),
    q(`SELECT d.*, a.nombre AS informe_nombre, b.nombre AS resuelto_nombre FROM discrepancias d
       LEFT JOIN usuarios a ON a.id=d.informe_por LEFT JOIN usuarios b ON b.id=d.resuelto_por WHERE lote_id=$1 ORDER BY id DESC`, [id]),
    q('SELECT fecha::text AS fecha, u.nombre FROM validaciones_dia v LEFT JOIN usuarios u ON u.id=v.validado_por WHERE lote_id=$1', [id]),
  ]);
  // Histórico del mismo galpón (RNF-05)
  const prevIds = (await q('SELECT id FROM lotes WHERE galpon_id=$1 AND id<>$2 ORDER BY fecha_entrada DESC LIMIT 6', [lote.galpon_id, id])).map(r => r.id);
  const historico = prevIds.length ? await lotesConKpi({ ids: prevIds }) : [];
  res.json({ ...lote, capturas, fotos, discrepancias, validaciones, historico });
}));

api.post('/lotes', requireRol('coordinacion', 'productor', 'galponero'), wrap(async (req, res) => {
  const { galpon_id, raza_id, incubadora, fecha_entrada, aves_alojadas, peso_inicial_g, observaciones } = req.body || {};
  let { codigo } = req.body || {};
  if (!galpon_id || !raza_id || !fecha_entrada || !(aves_alojadas > 0)) return bad(res, 'Galpón, raza, fecha de entrada y aves alojadas son obligatorios');
  const [ga] = await q('SELECT ga.*, g.nombre FROM galpones ga JOIN granjas g ON g.id=ga.granja_id WHERE ga.id=$1', [galpon_id]);
  if (!ga) return bad(res, 'Galpón no existe');
  if (!puedeGranja(req.user, ga.granja_id)) return bad(res, 'Sin acceso a esta granja', 403);
  const [activo] = await q("SELECT codigo FROM lotes WHERE galpon_id=$1 AND estado<>'cerrado'", [galpon_id]);
  if (activo) return bad(res, `El galpón ya tiene el lote ${activo.codigo} sin cerrar`);
  if (diffDias(fecha_entrada, hoyCaracas()) < 0) return bad(res, 'La fecha de entrada no puede ser futura');
  if (!codigo) codigo = `${ga.nombre.split(/\s+/).map(w => w[0]).join('').toUpperCase()}-G${ga.numero}-${fecha_entrada.slice(2).replace(/-/g, '')}`;
  const [l] = await q(`INSERT INTO lotes (codigo, galpon_id, raza_id, incubadora, fecha_entrada, aves_alojadas, peso_inicial_g, observaciones, creado_por)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [codigo.trim().toUpperCase(), galpon_id, raza_id, incubadora || null, fecha_entrada, aves_alojadas, peso_inicial_g || 42, observaciones || null, req.user.id]);
  await audit(req.user.id, 'abrir_lote', 'lote', l.id, { codigo, aves_alojadas });
  res.json({ id: l.id, codigo });
}));

api.post('/lotes/:id/validar-dia', requireRol('productor', 'coordinacion', 'veterinario'), wrap(async (req, res) => {
  const id = Number(req.params.id); const { fecha } = req.body || {};
  const g = await granjaDeLote(id);
  if (!g || !puedeGranja(req.user, g.granja_id)) return bad(res, 'Sin acceso', 403);
  await q('INSERT INTO validaciones_dia (lote_id, fecha, validado_por) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [id, fecha || hoyCaracas(), req.user.id]);
  await audit(req.user.id, 'validar_dia', 'lote', id, { fecha });
  res.json({ ok: true });
}));

// Cierre de lote + conciliación (RF-04)
api.post('/lotes/:id/cerrar', requireRol('coordinacion', 'productor'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const g = await granjaDeLote(id);
  if (!g || !puedeGranja(req.user, g.granja_id)) return bad(res, 'Sin acceso', 403);
  if (g.estado !== 'activo') return bad(res, 'El lote no está activo');
  const [lote] = await lotesConKpi({ ids: [id], detalle: true });
  if (!lote.despachos.length) return bad(res, 'Registre al menos un despacho (salida de aves) antes de cerrar el lote');
  const sinRecepcion = lote.despachos.filter(d => d.destino === 'planta' && d.aves_recibidas == null);
  if (sinRecepcion.length) return bad(res, `Faltan ${sinRecepcion.length} recepción(es) en planta beneficiadora por registrar`);
  const cat = await loadCatalogs();
  const tol = Number(cat.config.tolerancia_conciliacion ?? 2);
  const esperadas = lote.resumen.vivos_campo;
  const recibidas = lote.despachos.reduce((s, d) => s + (d.destino === 'planta' ? Number(d.aves_recibidas) : d.aves), 0);
  const dif = esperadas - recibidas;
  const pct = esperadas ? Math.abs(dif) / esperadas * 100 : 0;
  const fecha = req.body?.fecha || hoyCaracas();
  if (pct > tol) {
    await tx([
      ["UPDATE lotes SET estado='discrepancia' WHERE id=$1", [id]],
      ['INSERT INTO discrepancias (lote_id, aves_esperadas, aves_recibidas, diferencia, porcentaje) VALUES ($1,$2,$3,$4,$5)', [id, esperadas, recibidas, dif, pct.toFixed(2)]],
    ]);
    await audit(req.user.id, 'cierre_detenido', 'lote', id, { esperadas, recibidas, pct });
    return res.json({ estado: 'discrepancia', esperadas, recibidas, diferencia: dif, porcentaje: +pct.toFixed(2), tolerancia: tol });
  }
  await q("UPDATE lotes SET estado='cerrado', fecha_cierre=$2 WHERE id=$1", [id, fecha]);
  await audit(req.user.id, 'cerrar_lote', 'lote', id, { esperadas, recibidas, pct });
  res.json({ estado: 'cerrado', esperadas, recibidas, diferencia: dif, porcentaje: +pct.toFixed(2), tolerancia: tol });
}));

// ---------------- Sincronización offline (capturas, despachos y fotos) ----------------
const TIPOS = ['mortalidad', 'descarte', 'aba', 'pesaje', 'ambiente'];
api.post('/sync', wrap(async (req, res) => {
  const { capturas = [], despachos = [], fotos = [] } = req.body || {};
  const resultado = { capturas: {}, despachos: {}, fotos: {} };
  const loteIds = [...new Set([...capturas, ...despachos].map(c => Number(c.lote_id)))];
  const lotes = loteIds.length ? await lotesConKpi({ ids: loteIds }) : [];
  const lmap = Object.fromEntries(lotes.map(l => [l.id, l]));
  const saldoLocal = Object.fromEntries(lotes.map(l => [l.id, l.resumen.saldo]));
  const existentes = new Set((capturas.length ? await q('SELECT id FROM capturas WHERE id = ANY($1)', [capturas.map(c => c.id).filter(isUuid)]) : []).map(r => r.id));

  for (const c of capturas) {
    const l = lmap[Number(c.lote_id)];
    const err = (m) => (resultado.capturas[c.id] = { ok: false, error: m });
    if (!isUuid(c.id)) { err('ID inválido'); continue; }
    if (existentes.has(c.id)) { resultado.capturas[c.id] = { ok: true, duplicado: true }; continue; }
    if (!l) { err('Lote no existe'); continue; }
    if (!puedeGranja(req.user, l.granja_id)) { err('Sin acceso a la granja'); continue; }
    if (l.estado !== 'activo') { err('El lote ya no está activo'); continue; }
    if (!TIPOS.includes(c.tipo)) { err('Tipo inválido'); continue; }
    if (!c.fecha || c.fecha < l.fecha_entrada || c.fecha > hoyCaracas()) { err('Fecha fuera del ciclo del lote'); continue; }
    const cant = c.cantidad == null ? null : Number(c.cantidad);
    if (['mortalidad', 'descarte'].includes(c.tipo)) {
      if (!Number.isInteger(cant) || cant < 0) { err('Cantidad de aves inválida'); continue; }
      if (cant > saldoLocal[l.id]) { err(`La cantidad (${cant}) supera el saldo de aves (${saldoLocal[l.id]})`); continue; }
      saldoLocal[l.id] -= cant;
    }
    if (c.tipo === 'aba' && !(cant >= 0 && cant < 100000)) { err('Kg de alimento inválidos'); continue; }
    if (c.tipo === 'pesaje' && !(Number(c.peso_g) > 0 && Number(c.peso_g) < 6000)) { err('Peso inválido'); continue; }
    await q(`INSERT INTO capturas (id, lote_id, fecha, tipo, cantidad, causa, fase, peso_g, muestra, temperatura, humedad, observaciones, usuario_id, capturado_en)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO NOTHING`,
      [c.id, l.id, c.fecha, c.tipo, cant, c.causa || null, c.fase || null, c.peso_g || null, c.muestra || null, c.temperatura ?? null, c.humedad ?? null, c.observaciones || null, req.user.id, c.capturado_en || new Date().toISOString()]);
    resultado.capturas[c.id] = { ok: true };
  }

  for (const d of despachos) {
    const l = lmap[Number(d.lote_id)];
    const err = (m) => (resultado.despachos[d.id] = { ok: false, error: m });
    if (!isUuid(d.id)) { err('ID inválido'); continue; }
    const [ex] = await q('SELECT 1 FROM despachos WHERE id=$1', [d.id]);
    if (ex) { resultado.despachos[d.id] = { ok: true, duplicado: true }; continue; }
    if (!l || !puedeGranja(req.user, l.granja_id)) { err('Sin acceso al lote'); continue; }
    if (l.estado !== 'activo') { err('El lote ya no está activo'); continue; }
    if (!(d.aves > 0) || d.aves > saldoLocal[l.id]) { err(`Aves a despachar inválidas (saldo ${saldoLocal[l.id]})`); continue; }
    if (!(Number(d.kg_pie) > 0)) { err('Kg en pie inválidos'); continue; }
    saldoLocal[l.id] -= d.aves;
    await q(`INSERT INTO despachos (id, lote_id, fecha, destino, planta_id, cliente, aves, kg_pie, placa, flete, observaciones, usuario_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [d.id, l.id, d.fecha, d.destino, d.destino === 'planta' ? d.planta_id : null, d.cliente || null, d.aves, d.kg_pie, d.placa || null, d.flete || null, d.observaciones || null, req.user.id]);
    resultado.despachos[d.id] = { ok: true };
  }

  for (const f of fotos) {
    if (!isUuid(f.id) || !f.data) { resultado.fotos[f.id] = { ok: false, error: 'Foto inválida' }; continue; }
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(f.data);
    if (!m) { resultado.fotos[f.id] = { ok: false, error: 'Formato de imagen inválido' }; continue; }
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 3e6) { resultado.fotos[f.id] = { ok: false, error: 'Imagen demasiado grande' }; continue; }
    const loteId = Number(f.lote_id) || null;
    if (loteId) { const g = await granjaDeLote(loteId); if (!g || !puedeGranja(req.user, g.granja_id)) { resultado.fotos[f.id] = { ok: false, error: 'Sin acceso' }; continue; } }
    await q(`INSERT INTO fotos (id, captura_id, lote_id, ref_tipo, ref_id, mime, data, usuario_id) VALUES ($1,$2,$3,$4,$5,$6,decode($7,'base64'),$8) ON CONFLICT (id) DO NOTHING`,
      [f.id, isUuid(f.captura_id) ? f.captura_id : null, loteId, f.ref_tipo || 'captura', f.ref_id || f.captura_id || null, m[1], m[2], req.user.id]);
    resultado.fotos[f.id] = { ok: true };
  }
  if (capturas.length || despachos.length || fotos.length)
    await audit(req.user.id, 'sync', 'dispositivo', null, { capturas: capturas.length, despachos: despachos.length, fotos: fotos.length });
  res.json(resultado);
}));

api.post('/capturas/:id/anular', requireRol('coordinacion', 'veterinario', 'productor'), wrap(async (req, res) => {
  const [c] = await q('SELECT c.*, ga.granja_id FROM capturas c JOIN lotes l ON l.id=c.lote_id JOIN galpones ga ON ga.id=l.galpon_id WHERE c.id=$1', [req.params.id]);
  if (!c) return bad(res, 'Captura no encontrada', 404);
  if (!puedeGranja(req.user, c.granja_id)) return bad(res, 'Sin acceso', 403);
  await q('UPDATE capturas SET anulado=TRUE, anulado_por=$2 WHERE id=$1', [req.params.id, req.user.id]);
  await audit(req.user.id, 'anular_captura', 'captura', req.params.id, { motivo: req.body?.motivo, tipo: c.tipo, cantidad: c.cantidad, peso_g: c.peso_g });
  res.json({ ok: true });
}));

api.get('/fotos/:id', wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return bad(res, 'ID inválido');
  const [f] = await q("SELECT f.mime, encode(f.data,'base64') AS b64, f.lote_id FROM fotos f WHERE f.id=$1", [req.params.id]);
  if (!f) return bad(res, 'Foto no encontrada', 404);
  if (f.lote_id) { const g = await granjaDeLote(f.lote_id); if (g && !puedeGranja(req.user, g.granja_id)) return bad(res, 'Sin acceso', 403); }
  res.set('Content-Type', f.mime).set('Cache-Control', 'private, max-age=86400').send(Buffer.from(f.b64, 'base64'));
}));

// ---------------- Despachos y planta beneficiadora ----------------
api.get('/despachos', wrap(async (req, res) => {
  const gf = granjasFiltro(req.user);
  const rows = await q(`SELECT d.*, d.fecha::text AS fecha, l.codigo, g.nombre AS granja, ga.numero AS galpon, p.nombre AS planta,
      b.aves_recibidas, b.aves_muertas, b.kg_recibidos, b.und_tipo_a, b.kg_tipo_a, b.und_tipo_b, b.kg_tipo_b, b.fecha::text AS fecha_beneficio
    FROM despachos d JOIN lotes l ON l.id=d.lote_id JOIN galpones ga ON ga.id=l.galpon_id JOIN granjas g ON g.id=ga.granja_id
    LEFT JOIN plantas p ON p.id=d.planta_id LEFT JOIN beneficios b ON b.despacho_id=d.id
    WHERE NOT d.anulado ${gf ? 'AND g.id = ANY($1)' : ''} ORDER BY d.fecha DESC, d.creado_en DESC LIMIT 500`, gf ? [gf] : []);
  res.json(rows);
}));

api.post('/despachos', requireRol('coordinacion', 'productor', 'galponero'), wrap(async (req, res) => {
  const d = { ...req.body, id: req.body?.id || randomUUID() };
  req.body = { despachos: [d] };
  const l = (await lotesConKpi({ ids: [Number(d.lote_id)] }))[0];
  if (!l) return bad(res, 'Lote no encontrado', 404);
  if (!['planta', 'venta_pie'].includes(d.destino)) return bad(res, 'Destino inválido');
  if (d.destino === 'planta' && !d.planta_id) return bad(res, 'Seleccione la planta beneficiadora');
  if (d.destino === 'venta_pie' && !d.cliente) return bad(res, 'Indique el cliente');
  if (!(d.aves > 0) || d.aves > l.resumen.saldo) return bad(res, `Aves inválidas (saldo actual ${l.resumen.saldo})`);
  if (!(Number(d.kg_pie) > 0)) return bad(res, 'Kg en pie inválidos');
  if (!puedeGranja(req.user, l.granja_id)) return bad(res, 'Sin acceso', 403);
  if (l.estado !== 'activo') return bad(res, 'El lote no está activo');
  await q(`INSERT INTO despachos (id, lote_id, fecha, destino, planta_id, cliente, aves, kg_pie, placa, flete, observaciones, usuario_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
    [d.id, l.id, d.fecha || hoyCaracas(), d.destino, d.destino === 'planta' ? d.planta_id : null, d.cliente || null, d.aves, d.kg_pie, d.placa || null, d.flete || null, d.observaciones || null, req.user.id]);
  await audit(req.user.id, 'despacho', 'lote', l.id, { aves: d.aves, kg_pie: d.kg_pie, destino: d.destino });
  res.json({ ok: true, id: d.id });
}));

api.post('/despachos/:id/beneficio', requireRol('coordinacion'), wrap(async (req, res) => {
  const [d] = await q('SELECT d.*, l.estado FROM despachos d JOIN lotes l ON l.id=d.lote_id WHERE d.id=$1', [req.params.id]);
  if (!d) return bad(res, 'Despacho no encontrado', 404);
  if (d.destino !== 'planta') return bad(res, 'Solo los despachos a planta tienen recepción');
  const b = req.body || {};
  if (!(b.aves_recibidas >= 0) || !(Number(b.kg_recibidos) > 0)) return bad(res, 'Aves y kg recibidos son obligatorios');
  if (b.aves_recibidas > d.aves) return bad(res, 'Se recibieron más aves de las despachadas: revise los datos');
  await q(`INSERT INTO beneficios (despacho_id, fecha, aves_recibidas, aves_muertas, kg_recibidos, und_tipo_a, kg_tipo_a, und_tipo_b, kg_tipo_b, usuario_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (despacho_id) DO UPDATE SET fecha=EXCLUDED.fecha, aves_recibidas=EXCLUDED.aves_recibidas, aves_muertas=EXCLUDED.aves_muertas,
      kg_recibidos=EXCLUDED.kg_recibidos, und_tipo_a=EXCLUDED.und_tipo_a, kg_tipo_a=EXCLUDED.kg_tipo_a, und_tipo_b=EXCLUDED.und_tipo_b, kg_tipo_b=EXCLUDED.kg_tipo_b, usuario_id=EXCLUDED.usuario_id`,
    [d.id, b.fecha || hoyCaracas(), b.aves_recibidas, b.aves_muertas || 0, b.kg_recibidos, b.und_tipo_a || null, b.kg_tipo_a || null, b.und_tipo_b || null, b.kg_tipo_b || null, req.user.id]);
  await audit(req.user.id, 'recepcion_planta', 'despacho', d.id, b);
  res.json({ ok: true });
}));

api.post('/despachos/:id/anular', requireRol('coordinacion'), wrap(async (req, res) => {
  await q('UPDATE despachos SET anulado=TRUE WHERE id=$1', [req.params.id]);
  await audit(req.user.id, 'anular_despacho', 'despacho', req.params.id, req.body);
  res.json({ ok: true });
}));

// ---------------- Discrepancias (workflow) ----------------
api.get('/discrepancias', wrap(async (req, res) => {
  const gf = granjasFiltro(req.user);
  res.json(await q(`SELECT d.*, l.codigo, g.nombre AS granja, ga.numero AS galpon, a.nombre AS informe_nombre, b.nombre AS resuelto_nombre,
      (SELECT count(*)::int FROM fotos f WHERE f.ref_tipo='discrepancia' AND f.ref_id=d.id::text) AS evidencias
    FROM discrepancias d JOIN lotes l ON l.id=d.lote_id JOIN galpones ga ON ga.id=l.galpon_id JOIN granjas g ON g.id=ga.granja_id
    LEFT JOIN usuarios a ON a.id=d.informe_por LEFT JOIN usuarios b ON b.id=d.resuelto_por
    ${gf ? 'WHERE g.id = ANY($1)' : ''} ORDER BY (d.estado IN ('abierta','justificada')) DESC, d.id DESC`, gf ? [gf] : []));
}));

api.post('/discrepancias/:id/informe', requireRol('coordinacion'), wrap(async (req, res) => {
  const { informe } = req.body || {};
  if (!informe || informe.trim().length < 20) return bad(res, 'El informe debe explicar la causa (mínimo 20 caracteres)');
  const [d] = await q('SELECT * FROM discrepancias WHERE id=$1', [req.params.id]);
  if (!d || !['abierta', 'rechazada'].includes(d.estado)) return bad(res, 'La discrepancia no admite informe en su estado actual');
  const [{ n }] = await q("SELECT count(*)::int n FROM fotos WHERE ref_tipo='discrepancia' AND ref_id=$1", [String(d.id)]);
  if (!n) return bad(res, 'Adjunte al menos una evidencia antes de enviar el informe');
  await q("UPDATE discrepancias SET informe=$2, informe_por=$3, informe_en=now(), estado='justificada' WHERE id=$1", [d.id, informe.trim(), req.user.id]);
  await audit(req.user.id, 'informe_discrepancia', 'discrepancia', d.id);
  res.json({ ok: true });
}));

api.post('/discrepancias/:id/resolver', requireRol('gerencia'), wrap(async (req, res) => {
  const { aprobar, resolucion } = req.body || {};
  const [d] = await q('SELECT * FROM discrepancias WHERE id=$1', [req.params.id]);
  if (!d || d.estado !== 'justificada') return bad(res, 'Solo se resuelven discrepancias con informe enviado');
  if (aprobar) {
    await tx([
      ["UPDATE discrepancias SET estado='aprobada', resolucion=$2, resuelto_por=$3, resuelto_en=now() WHERE id=$1", [d.id, resolucion || null, req.user.id]],
      ["UPDATE lotes SET estado='cerrado', fecha_cierre=$2 WHERE id=$1", [d.lote_id, hoyCaracas()]],
    ]);
  } else {
    if (!resolucion) return bad(res, 'Indique el motivo del rechazo');
    await q("UPDATE discrepancias SET estado='rechazada', resolucion=$2, resuelto_por=$3, resuelto_en=now() WHERE id=$1", [d.id, resolucion, req.user.id]);
  }
  await audit(req.user.id, aprobar ? 'aprobar_discrepancia' : 'rechazar_discrepancia', 'discrepancia', d.id, { resolucion });
  res.json({ ok: true });
}));

// ---------------- Dashboard ejecutivo ----------------
api.get('/dashboard', wrap(async (req, res) => {
  const cat = await loadCatalogs();
  const metas = cat.config.metas || {};
  const todos = await lotesConKpi({ granjaIds: granjasFiltro(req.user), cat });
  const activos = todos.filter(l => l.estado === 'activo');
  const cerrados = todos.filter(l => l.estado !== 'activo');
  const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const wavg = (arr, f, w) => { const W = sum(arr.filter(x => f(x) != null), w); return W ? sum(arr.filter(x => f(x) != null), x => f(x) * w(x)) / W : null; };
  const alojadas = sum(activos, l => l.aves_alojadas);
  const conPeso = activos.filter(l => l.resumen.fcr != null);
  const kpis = {
    lotes_activos: activos.length, granjas_activas: new Set(activos.map(l => l.granja_id)).size,
    aves_vivas: sum(activos, l => l.resumen.saldo), aves_alojadas: alojadas,
    mortalidad_pct: alojadas ? sum(activos, l => l.resumen.mort_acum) / alojadas * 100 : null,
    fcr: wavg(conPeso, l => l.resumen.fcr, l => l.resumen.saldo),
    fcr_std: wavg(conPeso, l => l.resumen.fcr_std, l => l.resumen.saldo),
    cumplimiento: wavg(activos, l => l.resumen.cumplimiento, l => l.resumen.saldo),
    aba_kg: sum(activos, l => l.resumen.aba_acum_kg),
    capturas_pendientes: activos.filter(l => l.resumen.pendientes.length).length,
    alertas: activos.reduce((s, l) => s + l.resumen.alertas.length, 0),
    discrepancias_abiertas: todos.filter(l => l.estado === 'discrepancia').length,
  };
  // 8 indicadores: proyectado (meta/estándar) vs ejecutado — sobre lotes cerrados, o activos si no hay cierres
  const base = cerrados.length ? cerrados : activos;
  const ejec = {
    inv_inicial: sum(base, l => l.aves_alojadas),
    iee: wavg(base.filter(l => l.resumen.iee), l => l.resumen.iee, l => l.aves_alojadas),
    mortalidad: base.length ? sum(base, l => l.resumen.mort_acum) / sum(base, l => l.aves_alojadas) * 100 : null,
    edad: wavg(base.filter(l => l.resumen.edad), l => l.resumen.edad, l => l.aves_alojadas),
    peso: wavg(base.filter(l => l.resumen.peso_prom_kg), l => l.resumen.peso_prom_kg, l => l.aves_alojadas),
    gdp: wavg(base.filter(l => l.resumen.gdp), l => l.resumen.gdp, l => l.aves_alojadas),
    fcr: wavg(base.filter(l => l.resumen.fcr), l => l.resumen.fcr, l => l.aves_alojadas),
    inv_final: sum(base, l => l.estado === 'activo' ? l.resumen.saldo : l.resumen.aves_despachadas),
  };
  const proyMort = metas.mortalidad_pct ?? 5.5;
  const proy = {
    inv_inicial: ejec.inv_inicial, iee: metas.iee ?? 320, mortalidad: proyMort, edad: metas.edad_sacrificio ?? 39, peso: metas.peso_kg ?? 2.3,
    gdp: (metas.peso_kg ?? 2.3) * 1000 / (metas.edad_sacrificio ?? 39), fcr: metas.fcr ?? 1.71, inv_final: Math.round(ejec.inv_inicial * (1 - proyMort / 100)),
  };
  const menorEsMejor = { mortalidad: true, fcr: true, edad: true };
  const nombres = { inv_inicial: 'Inv. inicial', iee: 'I.E.E.', mortalidad: 'Mortalidad %', edad: 'Edad sacrif.', peso: 'Peso prom. kg', gdp: 'G.D.P. g', fcr: 'Conversión', inv_final: 'Inv. final' };
  const indicadores = Object.keys(nombres).map(k => {
    const p = proy[k], e = ejec[k];
    let c = null;
    if (p != null && e != null && p !== 0 && e !== 0) c = menorEsMejor[k] ? (k === 'mortalidad' ? (100 - e) / (100 - p) : p / e) : e / p;
    return { clave: k, nombre: nombres[k], proyectado: p, ejecutado: e, diferencia: p != null && e != null ? e - p : null, cumplimiento: c != null ? Math.round(c * 1000) / 10 : null };
  });
  // Curva peso real vs estándar (promedio ponderado de lotes activos por día de pesaje)
  const porRaza = {};
  for (const l of activos) (porRaza[l.raza] ||= []).push(l);
  const porGranja = Object.values(todos.reduce((m, l) => {
    const g = (m[l.granja] ||= { granja: l.granja, lotes: 0, aves: 0, mort: 0, alojadas: 0, fcr: [], iee: [], cumpl: [] });
    g.lotes++; g.alojadas += l.aves_alojadas; g.mort += l.resumen.mort_acum; g.aves += l.estado === 'activo' ? l.resumen.saldo : 0;
    if (l.resumen.fcr) g.fcr.push(l.resumen.fcr); if (l.resumen.iee) g.iee.push(l.resumen.iee); if (l.resumen.cumplimiento) g.cumpl.push(l.resumen.cumplimiento);
    return m;
  }, {})).map(g => ({ granja: g.granja, lotes: g.lotes, aves: g.aves, mortalidad: g.mort / g.alojadas * 100,
    fcr: g.fcr.length ? g.fcr.reduce((a, b) => a + b) / g.fcr.length : null, iee: g.iee.length ? g.iee.reduce((a, b) => a + b) / g.iee.length : null,
    cumplimiento: g.cumpl.length ? g.cumpl.reduce((a, b) => a + b) / g.cumpl.length : null }));
  const porRazaRes = Object.entries(todos.reduce((m, l) => { (m[l.raza] ||= []).push(l); return m; }, {})).map(([raza, ls]) => ({
    raza, lotes: ls.length, mortalidad: sum(ls, l => l.resumen.mort_acum) / sum(ls, l => l.aves_alojadas) * 100,
    fcr: wavg(ls.filter(l => l.resumen.fcr), l => l.resumen.fcr, l => l.aves_alojadas), iee: wavg(ls.filter(l => l.resumen.iee), l => l.resumen.iee, l => l.aves_alojadas),
    dif_peso: wavg(ls.filter(l => l.resumen.dif_peso_pct != null), l => l.resumen.dif_peso_pct, l => l.aves_alojadas),
  }));
  const alertas = activos.flatMap(l => l.resumen.alertas.map(a => ({ ...a, lote_id: l.id, codigo: l.codigo, granja: l.granja, galpon: l.galpon })))
    .sort((a, b) => (a.nivel === 'alta' ? -1 : 1) - (b.nivel === 'alta' ? -1 : 1));
  res.json({ kpis, indicadores, base_indicadores: cerrados.length ? 'lotes cerrados' : 'lotes activos', lotes: todos, por_granja: porGranja, por_raza: porRazaRes, alertas, metas, estandares: cat.estandares });
}));

// ---------------- Maestros ----------------
api.get('/granjas', wrap(async (req, res) => {
  const gf = granjasFiltro(req.user);
  res.json(await q(`SELECT g.*, (SELECT count(*)::int FROM galpones ga WHERE ga.granja_id=g.id AND ga.activo) AS galpones,
      (SELECT count(*)::int FROM lotes l JOIN galpones ga ON ga.id=l.galpon_id WHERE ga.granja_id=g.id AND l.estado='activo') AS lotes_activos,
      (SELECT count(*)::int FROM usuario_granjas ug WHERE ug.granja_id=g.id) AS personal,
      (SELECT json_agg(json_build_object('id',ga.id,'numero',ga.numero,'capacidad',ga.capacidad,'activo',ga.activo) ORDER BY ga.numero) FROM galpones ga WHERE ga.granja_id=g.id) AS lista_galpones
    FROM granjas g ${gf ? 'WHERE g.id = ANY($1)' : ''} ORDER BY g.activo DESC, g.nombre`, gf ? [gf] : []));
}));

api.post('/granjas', requireRol('coordinacion'), wrap(async (req, res) => {
  const { id, nombre, tipo, ubicacion, supervisor, activo, por_validar, galpones } = req.body || {};
  if (!nombre) return bad(res, 'El nombre es obligatorio');
  let gid = id;
  if (id) await q('UPDATE granjas SET nombre=$2, tipo=$3, ubicacion=$4, supervisor=$5, activo=$6, por_validar=$7 WHERE id=$1', [id, nombre, tipo || 'propia', ubicacion || null, supervisor || null, activo !== false, !!por_validar]);
  else gid = (await q("INSERT INTO granjas (nombre, tipo, ubicacion, supervisor, origen_dato) VALUES ($1,$2,$3,$4,'Sistema') RETURNING id", [nombre, tipo || 'propia', ubicacion || null, supervisor || null]))[0].id;
  const n = Number(galpones) || 0;
  for (let i = 1; i <= n; i++) await q('INSERT INTO galpones (granja_id, numero) VALUES ($1,$2) ON CONFLICT DO NOTHING', [gid, i]);
  await audit(req.user.id, id ? 'editar_granja' : 'crear_granja', 'granja', gid, req.body);
  res.json({ id: gid });
}));

api.post('/galpones', requireRol('coordinacion'), wrap(async (req, res) => {
  const { id, granja_id, numero, capacidad, activo } = req.body || {};
  if (id) await q('UPDATE galpones SET capacidad=$2, activo=$3 WHERE id=$1', [id, capacidad || null, activo !== false]);
  else await q('INSERT INTO galpones (granja_id, numero, capacidad) VALUES ($1,$2,$3)', [granja_id, numero, capacidad || null]);
  res.json({ ok: true });
}));

api.get('/estandares', wrap(async (req, res) => {
  const razas = await q('SELECT * FROM razas ORDER BY nombre');
  const est = await q('SELECT * FROM estandares ORDER BY raza_id, dia');
  res.json(razas.map(r => ({ ...r, puntos: est.filter(e => e.raza_id === r.id).map(e => ({ dia: e.dia, peso_g: e.peso_g == null ? null : Number(e.peso_g), fcr: e.fcr == null ? null : Number(e.fcr) })) })));
}));

api.put('/estandares/:razaId', requireRol('coordinacion'), wrap(async (req, res) => {
  const { puntos = [], fuente, por_validar, nombre } = req.body || {};
  const rid = Number(req.params.razaId);
  const items = [['UPDATE razas SET fuente=COALESCE($2,fuente), por_validar=$3, nombre=COALESCE($4,nombre) WHERE id=$1', [rid, fuente ?? null, !!por_validar, nombre ?? null]], ['DELETE FROM estandares WHERE raza_id=$1', [rid]]];
  for (const p of puntos) if (p.dia != null && (p.peso_g != null || p.fcr != null)) items.push(['INSERT INTO estandares (raza_id, dia, peso_g, fcr) VALUES ($1,$2,$3,$4)', [rid, p.dia, p.peso_g ?? null, p.fcr ?? null]]);
  await tx(items);
  await audit(req.user.id, 'editar_estandar', 'raza', rid, { puntos: puntos.length });
  res.json({ ok: true });
}));

api.post('/razas', requireRol('coordinacion'), wrap(async (req, res) => {
  const { nombre } = req.body || {};
  if (!nombre) return bad(res, 'Nombre obligatorio');
  const [r] = await q("INSERT INTO razas (nombre, fuente) VALUES ($1,'Creada en el sistema') RETURNING id", [nombre]);
  res.json(r);
}));

api.get('/config', wrap(async (req, res) => res.json((await loadCatalogs()).config)));
api.put('/config', requireRol('admin'), wrap(async (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) await q('INSERT INTO config (clave, valor) VALUES ($1,$2) ON CONFLICT (clave) DO UPDATE SET valor=EXCLUDED.valor', [k, JSON.stringify(v)]);
  await audit(req.user.id, 'editar_config', 'config', null, req.body);
  res.json({ ok: true });
}));

// ---------------- Usuarios ----------------
api.get('/usuarios', requireRol('admin'), wrap(async (req, res) => {
  res.json(await q(`SELECT u.id, u.username, u.nombre, u.rol, u.activo, u.creado_en,
    COALESCE((SELECT json_agg(granja_id) FROM usuario_granjas WHERE usuario_id=u.id), '[]') AS granjas FROM usuarios u ORDER BY u.activo DESC, u.rol, u.nombre`));
}));
api.get('/roles', (req, res) => res.json(ROL_NOMBRE));
api.post('/usuarios', requireRol('admin'), wrap(async (req, res) => {
  const { id, username, nombre, rol, password, activo, granjas = [] } = req.body || {};
  if (!username || !nombre || !ROL_NOMBRE[rol]) return bad(res, 'Usuario, nombre y rol son obligatorios');
  let uid = id;
  if (id) {
    await q('UPDATE usuarios SET username=$2, nombre=$3, rol=$4, activo=$5 WHERE id=$1', [id, username, nombre, rol, activo !== false]);
    if (password) await q('UPDATE usuarios SET password_hash=$2 WHERE id=$1', [id, await bcrypt.hash(password, 10)]);
  } else {
    if (!password || password.length < 6) return bad(res, 'La contraseña debe tener al menos 6 caracteres');
    const [dup] = await q('SELECT 1 FROM usuarios WHERE lower(username)=lower($1)', [username]);
    if (dup) return bad(res, 'Ese nombre de usuario ya existe');
    uid = (await q('INSERT INTO usuarios (username, nombre, rol, password_hash) VALUES ($1,$2,$3,$4) RETURNING id', [username, nombre, rol, await bcrypt.hash(password, 10)]))[0].id;
  }
  await tx([['DELETE FROM usuario_granjas WHERE usuario_id=$1', [uid]], ...granjas.map(g => ['INSERT INTO usuario_granjas (usuario_id, granja_id) VALUES ($1,$2)', [uid, g]])]);
  await audit(req.user.id, id ? 'editar_usuario' : 'crear_usuario', 'usuario', uid, { username, rol, granjas });
  res.json({ id: uid });
}));

api.get('/auditoria', requireRol('admin', 'gerencia'), wrap(async (req, res) => {
  res.json(await q(`SELECT a.*, u.nombre FROM auditoria a LEFT JOIN usuarios u ON u.id=a.usuario_id ORDER BY a.id DESC LIMIT 300`));
}));

// ---------------- Reportes ----------------
api.get('/reportes/lote/:id/excel', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const g = await granjaDeLote(id);
  if (!g || !puedeGranja(req.user, g.granja_id)) return bad(res, 'Sin acceso', 403);
  const [lote] = await lotesConKpi({ ids: [id], detalle: true });
  const buf = await reporteLote(lote, await loadCatalogs());
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .set('Content-Disposition', `attachment; filename="Lote_${lote.codigo}.xlsx"`).send(Buffer.from(buf));
}));
api.get('/reportes/lotes/excel', wrap(async (req, res) => {
  const lotes = await lotesConKpi({ granjaIds: granjasFiltro(req.user), estado: req.query.estado ? String(req.query.estado).split(',') : null });
  const buf = await reporteLotes(lotes);
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .set('Content-Disposition', `attachment; filename="Resumen_lotes_${hoyCaracas()}.xlsx"`).send(Buffer.from(buf));
}));

api.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno: ' + (err.message || 'desconocido') });
});

export default api;
