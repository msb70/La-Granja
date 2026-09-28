// Carga inicial: catálogos, estándares genéticos, usuarios y datos de demostración.
// Uso: node server/seed.js [--reset-demo]
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { q } from './db.js';
import { migrate } from './migrate.js';

const DEMO_PASS = process.env.DEMO_PASSWORD || 'Granja2026';

// ---------- Configuración / metas ----------
const CONFIG = {
  dias_hito: [0, 1, 7, 10, 14, 21, 28, 33, 35],
  fases_aba: [
    { fase: 'preinicio', nombre: 'Pre-inicio', desde: 0, hasta: 10 },
    { fase: 'inicio', nombre: 'Inicio', desde: 11, hasta: 18 },
    { fase: 'engorde', nombre: 'Engorde / Terminador', desde: 19, hasta: 999 },
  ],
  tolerancia_conciliacion: 2,
  metas: { mortalidad_pct: 5.5, fcr: 1.71, iee: 320, peso_kg: 2.3, edad_sacrificio: 39, rendimiento_canal: 92, pollo_a_pct: 95 },
  ciclo_dias: 40,
  ventana_captura: { desde: '07:00', hasta: '16:00' },
};

// ---------- Estándares genéticos ----------
// Hubbard 1,2: valores de la plantilla del cliente (cuaderno de campo). FCR aproximado, por validar.
// Cobb 500 / Ross 308: valores de referencia públicos aproximados — POR VALIDAR con las tablas oficiales del cliente.
const RAZAS = [
  { nombre: 'Hubbard 1,2', fuente: 'Plantilla de registro del cliente (pesos). FCR aproximado, por validar.', por_validar: true,
    puntos: { 0: [42], 1: [63], 2: [73], 3: [89], 4: [107], 5: [131], 6: [158], 7: [186, 0.88], 8: [222], 9: [261], 10: [302],
      14: [502, 1.08], 21: [993, 1.28], 28: [1560, 1.43], 33: [1989, 1.53], 35: [2164, 1.57], 42: [2800, 1.72] } },
  { nombre: 'Cobb 500', fuente: 'Referencia pública aproximada (Cobb 500 Broiler Performance Objectives). Por validar.', por_validar: true,
    puntos: { 0: [42], 7: [185, 0.87], 14: [465, 1.05], 21: [943, 1.25], 28: [1524, 1.41], 35: [2191, 1.55], 42: [2857, 1.69] } },
  { nombre: 'Ross 308', fuente: 'Referencia pública aproximada (Ross 308 Performance Objectives). Por validar.', por_validar: true,
    puntos: { 0: [44], 7: [208, 0.88], 14: [532, 1.06], 21: [1049, 1.25], 28: [1695, 1.40], 35: [2402, 1.53], 42: [3087, 1.66] } },
];

// ---------- Granjas: unión ERS + Excel Avance Productivo agosto 2026 ----------
const G = (nombre, tipo, origen, ubicacion = null, por_validar = false) => ({ nombre, tipo, origen, ubicacion, por_validar });
const GRANJAS = [
  G('Nuevo Amanecer', 'propia', 'ERS'),
  G('Amparo', 'propia', 'ERS + Excel', 'Edo. Carabobo, Mcpio. Diego Ibarra, sector El Depósito'),
  G('Guadalupana', 'propia', 'ERS + Excel', 'Edo. Carabobo, Mcpio. Guigue, sector Las Vegas'),
  G('Los Flamencos', 'propia', 'ERS + Excel'),
  G('La Princesa', 'propia', 'ERS + Excel', 'Edo. Carabobo, Mcpio. Guigue, sector Cogoyal'),
  G('Doña Julia', 'propia', 'ERS + Excel'),
  G('Santa Clara', 'propia', 'ERS + Excel', 'Edo. Carabobo, Mcpio. Diego Ibarra, sector Los Cocos'),
  G('Valle Bonito', 'propia', 'ERS + Excel'),
  G('Cabaña', 'propia', 'ERS + Excel', 'Edo. Miranda, Mcpio. Guaicaipuro, sector El Boquerón'),
  G('Isleña', 'propia', 'ERS + Excel', 'Edo. Aragua, Mcpio. Villa de Cura, sector El Chorro'),
  G('Arianna', 'propia', 'ERS + Excel', 'Edo. Miranda, Mcpio. Andrés Bello, sector San Pedro'),
  G('San Rafael', 'propia', 'ERS + Excel'),
  G('Villa de Mazo', 'tercero', 'ERS + Excel', 'Edo. Carabobo, Mcpio. Villa de Cura, sector El Chorro'),
  G('Lena', 'tercero', 'ERS'),
  G('Agua Santa', 'tercero', 'ERS + Excel', 'Edo. Carabobo, Mcpio. Carlos Arvelo, sector Cogoyal'),
  // Aparecen solo en el Excel: tipo por confirmar
  G('Terra Nostra', 'propia', 'Excel agosto', null, true),
  G('Santa María', 'propia', 'Excel agosto', 'Edo. Carabobo, Mcpio. Zamora, sector Agua Honda', true),
  G('Santa María 2', 'propia', 'Excel agosto', 'Edo. Carabobo, Mcpio. Guigue, sector Las Vegas', true),
  G('Santa Lucía', 'propia', 'Excel agosto', 'Edo. Aragua, Mcpio. Carlos Arvelo, sector Bella Vista', true),
  G('Gabrida', 'propia', 'Excel agosto', 'Edo. Miranda, Mcpio. Guaicaipuro, sector El Prado', true),
  G('Elzettawi', 'propia', 'Excel agosto', 'Edo. Carabobo, Mcpio. Montalbán, sector Sabaneta', true),
  G('La Palma Nueva', 'propia', 'Excel agosto', 'Edo. Yaracuy, Mcpio. Miranda, sector San José', true),
  G('Mara', 'propia', 'Excel agosto', 'Edo. Carabobo, Mcpio. Guigue, sector Cogoyal', true),
];

const USUARIOS = [
  { username: 'admin', nombre: 'Administrador del sistema', rol: 'admin' },
  { username: 'gerencia', nombre: 'Gerencia General', rol: 'gerencia' },
  { username: 'coordinacion', nombre: 'Coordinación Central', rol: 'coordinacion' },
  { username: 'veterinario', nombre: 'Inspector Veterinario', rol: 'veterinario', granjas: ['Nuevo Amanecer', 'Amparo', 'Guadalupana', 'Santa Clara', 'Isleña'] },
  { username: 'productor', nombre: 'Productor Nuevo Amanecer', rol: 'productor', granjas: ['Nuevo Amanecer', 'Amparo'] },
  { username: 'galponero', nombre: 'Galponero Nuevo Amanecer', rol: 'galponero', granjas: ['Nuevo Amanecer', 'Amparo'] },
];

// ---------- Lote real del cuaderno: Nuevo Amanecer · Galpón 2 ----------
// Semanas comienzan el jueves (día 1 = 30/07/2026). Filas J V S D L M M.
const REAL = {
  codigo: 'NA-G2-260729', granja: 'Nuevo Amanecer', galpon: 2, raza: 'Hubbard 1,2', incubadora: 'JHS',
  fecha_entrada: '2026-07-29', aves: 5661,
  mortalidad: [[4, 4, 2, 2, 3, 1, 2], [3, 5, 1, 1, 1, 1, 4], [3, 5, 2, 5, 2, 6, 3], [4, 2, 1, 1, 3, 5, 8], [11, 21, 32, 36, 14, 9, 8], [12, 9, 6, 4, 15]],
  aba: [[440, 80, 80, 140, 160, 160, 120], [280, 160, 240, 240, 240, 200, 400], [320, 480, 480, 600, 640, 600, 600], [600, 600, 600, 600, 760, 760, 640], [760, 760, 680, 640, 760, 760, 760], [240, 240, 240, 210, 160]],
  pesos: { 0: 42, 1: 60, 2: 74, 3: 94, 4: 111, 5: 132, 6: 153, 7: 174, 8: 203, 9: 228, 10: 249, 14: 360, 21: 833, 28: 1393, 33: 1900, 35: 2080 },
};

// ---------- utilidades ----------
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const today = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10); // hora de Venezuela (UTC-4)
const fase = (dia) => (dia <= 10 ? 'preinicio' : dia <= 18 ? 'inicio' : 'engorde');
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function interp(puntos, dia) {
  const ks = Object.keys(puntos).map(Number).sort((a, b) => a - b);
  if (dia <= ks[0]) return puntos[ks[0]][0];
  for (let i = 1; i < ks.length; i++) if (dia <= ks[i]) {
    const a = ks[i - 1], b = ks[i]; return puntos[a][0] + (puntos[b][0] - puntos[a][0]) * (dia - a) / (b - a);
  }
  return puntos[ks[ks.length - 1]][0];
}
async function insertJson(table, rows) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += 500) {
    await q(`INSERT INTO ${table} SELECT * FROM json_populate_recordset(NULL::${table}, $1) ON CONFLICT DO NOTHING`, [JSON.stringify(rows.slice(i, i + 500))]);
  }
}
const cap = (o) => ({ id: randomUUID(), cantidad: null, causa: null, fase: null, peso_g: null, muestra: null, temperatura: null, humedad: null,
  observaciones: null, anulado: false, anulado_por: null, capturado_en: o.fecha + 'T10:00:00-04:00', sincronizado_en: new Date().toISOString(), ...o });

export async function seed({ resetDemo = false } = {}) {
  await migrate();

  for (const [k, v] of Object.entries(CONFIG))
    await q('INSERT INTO config (clave, valor) VALUES ($1,$2) ON CONFLICT (clave) DO NOTHING', [k, JSON.stringify(v)]);

  for (const r of RAZAS) {
    const [row] = await q('INSERT INTO razas (nombre, fuente, por_validar) VALUES ($1,$2,$3) ON CONFLICT (nombre) DO UPDATE SET nombre=EXCLUDED.nombre RETURNING id', [r.nombre, r.fuente, r.por_validar]);
    for (const [dia, [peso, fcr]] of Object.entries(r.puntos))
      await q('INSERT INTO estandares (raza_id, dia, peso_g, fcr) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [row.id, +dia, peso, fcr ?? null]);
  }
  for (const n of ['JHS', 'Importación', 'Externa']) await q('INSERT INTO incubadoras (nombre) VALUES ($1) ON CONFLICT DO NOTHING', [n]);
  for (const n of ['Kamil', 'Todovito']) await q('INSERT INTO plantas (nombre) VALUES ($1) ON CONFLICT DO NOTHING', [n]);

  for (const g of GRANJAS) {
    const [row] = await q(`INSERT INTO granjas (nombre, tipo, ubicacion, origen_dato, por_validar) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (nombre) DO UPDATE SET nombre=EXCLUDED.nombre RETURNING id`, [g.nombre, g.tipo, g.ubicacion, g.origen, g.por_validar]);
    const n = g.nombre === 'Nuevo Amanecer' ? 4 : 1;
    for (let i = 1; i <= n; i++) await q('INSERT INTO galpones (granja_id, numero) VALUES ($1,$2) ON CONFLICT DO NOTHING', [row.id, i]);
  }

  const hash = await bcrypt.hash(DEMO_PASS, 10);
  for (const u of USUARIOS) {
    const [row] = await q(`INSERT INTO usuarios (username, nombre, password_hash, rol) VALUES ($1,$2,$3,$4)
      ON CONFLICT (username) DO UPDATE SET username=EXCLUDED.username RETURNING id`, [u.username, u.nombre, hash, u.rol]);
    for (const gn of u.granjas || [])
      await q('INSERT INTO usuario_granjas (usuario_id, granja_id) SELECT $1, id FROM granjas WHERE nombre=$2 ON CONFLICT DO NOTHING', [row.id, gn]);
  }

  if (resetDemo) await q("DELETE FROM lotes WHERE demo = TRUE OR codigo = $1", [REAL.codigo]);
  const [{ n }] = await q('SELECT count(*)::int AS n FROM lotes');
  if (n > 0) { console.log('Ya existen lotes; no se cargan datos de demostración.'); return; }

  const users = Object.fromEntries((await q('SELECT id, username FROM usuarios')).map(u => [u.username, u.id]));
  const razas = Object.fromEntries((await q('SELECT id, nombre FROM razas')).map(r => [r.nombre, r.id]));
  const galpon = async (granja, num) => (await q('SELECT ga.id FROM galpones ga JOIN granjas g ON g.id=ga.granja_id WHERE g.nombre=$1 AND ga.numero=$2', [granja, num]))[0].id;
  const nuevoLote = async (o) => (await q(`INSERT INTO lotes (codigo, galpon_id, raza_id, incubadora, fecha_entrada, aves_alojadas, estado, fecha_cierre, observaciones, demo, creado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [o.codigo, await galpon(o.granja, o.galpon), razas[o.raza], o.incubadora || 'JHS', o.fecha_entrada, o.aves, o.estado || 'activo', o.fecha_cierre || null, o.obs || null, !!o.demo, users.coordinacion]))[0].id;

  // --- lote real ---
  const realId = await nuevoLote({ ...REAL, obs: 'Datos transcritos del cuaderno de campo (foto del registro físico). Sin cierre registrado.' });
  const caps = [];
  REAL.mortalidad.forEach((sem, w) => sem.forEach((v, i) => { const dia = w * 7 + i + 1; if (v) caps.push(cap({ lote_id: realId, fecha: addDays(REAL.fecha_entrada, dia), tipo: 'mortalidad', cantidad: v, causa: 'otra', usuario_id: users.galponero })); }));
  REAL.aba.forEach((sem, w) => sem.forEach((v, i) => { const dia = w * 7 + i + 1; caps.push(cap({ lote_id: realId, fecha: addDays(REAL.fecha_entrada, dia), tipo: 'aba', cantidad: v, fase: fase(dia), usuario_id: users.galponero })); }));
  for (const [dia, p] of Object.entries(REAL.pesos)) caps.push(cap({ lote_id: realId, fecha: addDays(REAL.fecha_entrada, +dia), tipo: 'pesaje', peso_g: p, muestra: 100, usuario_id: users.galponero }));
  await insertJson('capturas', caps);

  // --- lotes simulados de demostración ---
  const hoy = today();
  const SIM = [
    { granja: 'Amparo', galpon: 1, raza: 'Cobb 500', edad: 18, aves: 24000, perf: 0.99, mort: 1.0 },
    { granja: 'Guadalupana', galpon: 1, raza: 'Ross 308', edad: 33, aves: 17800, perf: 0.95, mort: 1.4 },
    { granja: 'Santa Clara', galpon: 1, raza: 'Hubbard 1,2', edad: 7, aves: 30900, perf: 1.01, mort: 0.9 },
    { granja: 'Villa de Mazo', galpon: 1, raza: 'Cobb 500', edad: 25, aves: 40000, perf: 0.97, mort: 1.1 },
    { granja: 'La Princesa', galpon: 1, raza: 'Hubbard 1,2', edad: 2, aves: 39565, perf: 1.0, mort: 1.0 },
    { granja: 'Valle Bonito', galpon: 1, raza: 'Ross 308', edad: 38, aves: 22000, perf: 0.92, mort: 2.2 },
    { granja: 'Cabaña', galpon: 1, raza: 'Hubbard 1,2', edad: 55, aves: 21000, perf: 0.98, mort: 1.0, cerrar: 40, recepcion: 0.992 },
    { granja: 'Isleña', galpon: 1, raza: 'Cobb 500', edad: 50, aves: 16000, perf: 0.96, mort: 1.3, cerrar: 41, recepcion: 0.965 },
  ];
  const hitos = CONFIG.dias_hito;
  let seedN = 7;
  for (const s of SIM) {
    const rand = rng(seedN++ * 7919);
    const entrada = addDays(hoy, -s.edad);
    const ultimoDia = s.cerrar ? s.cerrar : s.edad - (rand() < 0.5 ? 1 : 0); // algunos sin captura de hoy
    const codigo = `${s.granja.split(' ').map(w => w[0]).join('').toUpperCase()}-G${s.galpon}-${entrada.slice(2).replace(/-/g, '')}`;
    const loteId = await nuevoLote({ ...s, codigo, fecha_entrada: entrada, demo: true, obs: 'Lote simulado para demostración.' });
    const puntos = RAZAS.find(r => r.nombre === s.raza).puntos;
    const out = []; let vivas = s.aves;
    for (let dia = 1; dia <= ultimoDia; dia++) {
      const fecha = addDays(entrada, dia);
      const tasa = (dia <= 7 ? 0.0012 : dia <= 21 ? 0.0005 : 0.0007) * s.mort * (0.5 + rand());
      const m = Math.round(vivas * tasa);
      if (m) { const r = rand(); out.push(cap({ lote_id: loteId, fecha, tipo: 'mortalidad', cantidad: m, causa: r < 0.6 ? 'patologica' : r < 0.85 ? 'ambiental' : 'mecanica', usuario_id: users.galponero })); }
      const d = dia % 9 === 0 ? Math.round(vivas * 0.0004) : 0;
      if (d) out.push(cap({ lote_id: loteId, fecha, tipo: 'descarte', cantidad: d, causa: 'Bajo desarrollo', usuario_id: users.galponero }));
      vivas -= m + d;
      const pesoStd = interp(puntos, dia);
      const gad = interp({ 0: [12], 7: [36], 14: [75], 21: [118], 28: [155], 35: [185], 42: [205] }, dia) * (0.96 + rand() * 0.08) * (2 - s.perf); // g/ave/día
      out.push(cap({ lote_id: loteId, fecha, tipo: 'aba', cantidad: Math.round(vivas * gad / 1000 / 10) * 10, fase: fase(dia), usuario_id: users.galponero }));
      if (hitos.includes(dia) || dia === ultimoDia && s.cerrar) out.push(cap({ lote_id: loteId, fecha, tipo: 'pesaje', peso_g: Math.round(pesoStd * s.perf * (0.98 + rand() * 0.04)), muestra: 100, usuario_id: users.veterinario }));
      if (dia % 3 === 0) out.push(cap({ lote_id: loteId, fecha, tipo: 'ambiente', temperatura: +(27 + rand() * 6).toFixed(1), humedad: Math.round(60 + rand() * 20), usuario_id: users.galponero }));
    }
    out.push(cap({ lote_id: loteId, fecha: entrada, tipo: 'pesaje', peso_g: 42, muestra: 100, usuario_id: users.galponero }));
    await insertJson('capturas', out);

    if (s.cerrar) {
      const pesoFinal = interp(puntos, s.cerrar) * s.perf / 1000;
      const d1 = Math.round(vivas * 0.8), d2 = vivas - d1;
      const desp = [
        { id: randomUUID(), lote_id: loteId, fecha: addDays(entrada, s.cerrar), destino: 'planta', planta_id: 1, cliente: null, aves: d1, kg_pie: Math.round(d1 * pesoFinal), placa: 'A35SCU1M', flete: null, observaciones: null, anulado: false, usuario_id: users.coordinacion, creado_en: new Date().toISOString() },
        { id: randomUUID(), lote_id: loteId, fecha: addDays(entrada, s.cerrar), destino: 'venta_pie', planta_id: null, cliente: 'Cliente externo', aves: d2, kg_pie: Math.round(d2 * pesoFinal), placa: 'A62BO8A', flete: 180, observaciones: null, anulado: false, usuario_id: users.coordinacion, creado_en: new Date().toISOString() },
      ];
      await insertJson('despachos', desp);
      const recib = Math.round(d1 * s.recepcion);
      const kgRec = Math.round(desp[0].kg_pie * s.recepcion * 0.995);
      const kgA = Math.round(kgRec * 0.88 * 0.9), kgB = Math.round(kgRec * 0.88 * 0.1);
      await q(`INSERT INTO beneficios (despacho_id, fecha, aves_recibidas, aves_muertas, kg_recibidos, und_tipo_a, kg_tipo_a, und_tipo_b, kg_tipo_b, usuario_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [desp[0].id, addDays(entrada, s.cerrar + 1), recib, Math.round((d1 - recib) * 0.3), kgRec, Math.round(recib * 0.9), kgA, recib - Math.round(recib * 0.9), kgB, users.coordinacion]);
      const esperadas = d1 + d2, recibidas = recib + d2, dif = esperadas - recibidas, pct = dif / esperadas * 100;
      if (pct > CONFIG.tolerancia_conciliacion) {
        await q("UPDATE lotes SET estado='discrepancia' WHERE id=$1", [loteId]);
        await q('INSERT INTO discrepancias (lote_id, aves_esperadas, aves_recibidas, diferencia, porcentaje) VALUES ($1,$2,$3,$4,$5)', [loteId, esperadas, recibidas, dif, pct.toFixed(2)]);
      } else {
        await q("UPDATE lotes SET estado='cerrado', fecha_cierre=$2 WHERE id=$1", [loteId, addDays(entrada, s.cerrar + 1)]);
      }
    }
  }
  console.log('Datos de demostración cargados.');
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed({ resetDemo: process.argv.includes('--reset-demo') }).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
