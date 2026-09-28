// Motor de cálculo de indicadores — una sola fuente de verdad para web, móvil y reportes.
import { q } from './db.js';

export const hoyCaracas = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
export const diffDias = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400e3);
export const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
const num = (v) => (v == null ? null : Number(v));
const r = (v, d = 2) => (v == null || !isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Interpola el estándar genético (peso o fcr) para un día dado */
export function stdAt(puntos, dia, campo = 'peso_g') {
  const pts = puntos.filter(p => p[campo] != null).sort((a, b) => a.dia - b.dia);
  if (!pts.length) return null;
  if (dia <= pts[0].dia) return Number(pts[0][campo]);
  for (let i = 1; i < pts.length; i++) if (dia <= pts[i].dia) {
    const a = pts[i - 1], b = pts[i];
    return Number(a[campo]) + (Number(b[campo]) - Number(a[campo])) * (dia - a.dia) / (b.dia - a.dia);
  }
  const last = pts[pts.length - 1];
  if (pts.length >= 2 && campo === 'peso_g') { // extrapolación lineal suave
    const a = pts[pts.length - 2];
    return Number(last[campo]) + (Number(last[campo]) - Number(a[campo])) * (dia - last.dia) / (last.dia - a.dia);
  }
  return Number(last[campo]);
}

export async function loadCatalogs() {
  const [cfgRows, est] = await Promise.all([
    q('SELECT clave, valor FROM config'),
    q('SELECT raza_id, dia, peso_g, fcr FROM estandares ORDER BY raza_id, dia'),
  ]);
  const config = Object.fromEntries(cfgRows.map(c => [c.clave, c.valor]));
  const estandares = {};
  for (const e of est) (estandares[e.raza_id] ||= []).push({ dia: e.dia, peso_g: num(e.peso_g), fcr: num(e.fcr) });
  return { config, estandares };
}

/**
 * Calcula el estado completo de un lote.
 * @param lote fila de lotes (+ granja, galpon, raza)
 * @param caps  capturas agregadas por día: [{fecha, tipo, cantidad, peso_g, temperatura, humedad}]
 * @param desp  despachos [{fecha, aves, kg_pie, destino, beneficio:{...}}]
 */
export function calcularLote(lote, caps, desp, cat) {
  const { config, estandares } = cat;
  const metas = config.metas || {};
  const std = estandares[lote.raza_id] || [];
  const entrada = iso(lote.fecha_entrada);
  const hoy = hoyCaracas();
  const abierto = lote.estado === 'activo';
  const ultimaCaptura = caps.reduce((m, c) => (iso(c.fecha) > m ? iso(c.fecha) : m), entrada);
  const ultimoDespacho = desp.reduce((m, d) => (iso(d.fecha) > m ? iso(d.fecha) : m), entrada);
  const fin = abierto ? hoy : (lote.fecha_cierre ? iso(lote.fecha_cierre) : (ultimoDespacho > ultimaCaptura ? ultimoDespacho : ultimaCaptura));
  const diaActual = Math.max(0, diffDias(entrada, fin));
  const diaUltCaptura = diffDias(entrada, ultimaCaptura);

  // Serie diaria
  const porDia = new Map();
  const get = (d) => { if (!porDia.has(d)) porDia.set(d, { dia: d, fecha: addDays(entrada, d), mort: 0, desc: 0, aba: 0, peso: null, temp: null, hum: null, salidas: 0, kg_salidas: 0, registrado: new Set() }); return porDia.get(d); };
  for (const c of caps) {
    const d = diffDias(entrada, iso(c.fecha)); if (d < 0) continue;
    const x = get(d); x.registrado.add(c.tipo);
    if (c.tipo === 'mortalidad') x.mort += num(c.cantidad) || 0;
    else if (c.tipo === 'descarte') x.desc += num(c.cantidad) || 0;
    else if (c.tipo === 'aba') x.aba += num(c.cantidad) || 0;
    else if (c.tipo === 'pesaje') x.peso = num(c.peso_g);
    else if (c.tipo === 'ambiente') { x.temp = num(c.temperatura); x.hum = num(c.humedad); }
  }
  for (const d of desp) { const x = get(Math.max(0, diffDias(entrada, iso(d.fecha)))); x.salidas += d.aves; x.kg_salidas += Number(d.kg_pie); }

  const dias = [];
  let mortA = 0, descA = 0, abaA = 0, salA = 0, kgSalA = 0, pesoPrev = null, diaPesoPrev = null;
  const maxDia = Math.max(diaActual, ...[...porDia.keys()]);
  for (let d = 0; d <= maxDia; d++) {
    const x = porDia.get(d) || get(d);
    mortA += x.mort; descA += x.desc; abaA += x.aba; salA += x.salidas; kgSalA += x.kg_salidas;
    const saldo = lote.aves_alojadas - mortA - descA - salA;
    const vivasInicio = saldo + x.mort + x.desc + x.salidas;
    const pStd = stdAt(std, d, 'peso_g');
    const row = {
      dia: d, fecha: x.fecha, mortalidad: x.mort, descarte: x.desc, aba_kg: x.aba, peso_g: x.peso, temp: x.temp, humedad: x.hum,
      salidas: x.salidas, mort_acum: mortA, desc_acum: descA, aba_acum_kg: abaA, saldo,
      pct_mort_dia: vivasInicio ? r(x.mort / vivasInicio * 100, 3) : null,
      pct_mort_acum: r(mortA / lote.aves_alojadas * 100, 2),
      gr_ave_dia: saldo > 0 && x.aba ? r(x.aba * 1000 / saldo, 1) : null,
      peso_std_g: pStd != null ? r(pStd, 0) : null,
      registrado: [...x.registrado],
    };
    if (x.peso != null) {
      const kgVivos = saldo * x.peso / 1000 + kgSalA;
      row.fcr = kgVivos > 0 && d >= 7 ? r(abaA / kgVivos, 3) : null;
      row.fcr_std = r(stdAt(std, d, 'fcr'), 3);
      row.dif_peso_pct = pStd ? r((x.peso - pStd) / pStd * 100, 1) : null;
      row.gdp = pesoPrev != null && d > diaPesoPrev ? r((x.peso - pesoPrev) / (d - diaPesoPrev), 1) : null;
      row.kg_producidos = r(kgVivos, 1);
      const viab = (lote.aves_alojadas - mortA - descA) / lote.aves_alojadas * 100;
      row.iee = d >= 28 && row.fcr ? r(viab * (x.peso / 1000) / (d * row.fcr) * 100, 0) : null;
      pesoPrev = x.peso; diaPesoPrev = d;
    }
    dias.push(row);
  }

  // Semanas estilo cuaderno (día 1–7 = semana 1)
  const semanas = [];
  const maxDatos = Math.max(1, ...[...porDia.values()].filter(x => x.registrado.size || x.salidas).map(x => x.dia));
  for (let w = 1; w <= Math.ceil(maxDatos / 7); w++) {
    const ds = dias.filter(x => x.dia >= (w - 1) * 7 + 1 && x.dia <= w * 7);
    if (!ds.length) continue;
    const last = ds[ds.length - 1];
    const mortSem = ds.reduce((s, x) => s + x.mortalidad, 0);
    const abaSem = ds.reduce((s, x) => s + x.aba_kg, 0);
    const pesaje = [...ds].reverse().find(x => x.peso_g != null);
    const vivasIni = (dias[(w - 1) * 7] || dias[0]).saldo;
    semanas.push({
      semana: w, dias: ds.map(x => ({ dia: x.dia, fecha: x.fecha, mort: x.mortalidad, aba: x.aba_kg })),
      mort_sem: mortSem, desc_sem: ds.reduce((s, x) => s + x.descarte, 0), mort_acum: last.mort_acum,
      pct_sem: r(mortSem / lote.aves_alojadas * 100, 2), pct_acum: last.pct_mort_acum, saldo: last.saldo,
      aba_sem: abaSem, aba_acum: last.aba_acum_kg,
      gr_ave_sem: last.saldo ? r(abaSem * 1000 / last.saldo, 1) : null,
      gr_ave_dia: last.saldo ? r(abaSem * 1000 / last.saldo / ds.length, 1) : null,
      peso_g: pesaje?.peso_g ?? null, kg_producidos: pesaje?.kg_producidos ?? null, fcr: pesaje?.fcr ?? null,
    });
  }

  // Resumen
  const ult = dias[dias.length - 1] || {};
  const ultPesaje = [...dias].reverse().find(x => x.peso_g != null);
  const avesDesp = desp.reduce((s, d) => s + d.aves, 0);
  const kgDesp = desp.reduce((s, d) => s + Number(d.kg_pie), 0);
  const cerradoConDespacho = avesDesp > 0 && !abierto;
  let peso_kg, edad, fcr, viab, iee;
  const vivosCampo = lote.aves_alojadas - (ult.mort_acum || 0) - (ult.desc_acum || 0);
  if (cerradoConDespacho) {
    peso_kg = kgDesp / avesDesp;
    edad = desp.reduce((s, d) => s + d.aves * diffDias(entrada, iso(d.fecha)), 0) / avesDesp;
    fcr = (ult.aba_acum_kg || 0) / kgDesp;
    viab = avesDesp / lote.aves_alojadas * 100;
  } else if (ultPesaje) {
    peso_kg = ultPesaje.peso_g / 1000; edad = ultPesaje.dia; fcr = ultPesaje.fcr;
    viab = (lote.aves_alojadas - ultPesaje.mort_acum - ultPesaje.desc_acum) / lote.aves_alojadas * 100;
  }
  if (peso_kg && edad >= 28 && fcr) iee = viab * peso_kg / (edad * fcr) * 100;

  const pesoStdUlt = ultPesaje ? ultPesaje.peso_std_g : null;
  const fcrStd = ultPesaje ? ultPesaje.fcr_std : null;
  // GDP del lote: (peso actual - peso inicial) / días
  const gdp = ultPesaje && ultPesaje.dia > 0 ? (ultPesaje.peso_g - Number(lote.peso_inicial_g || 42)) / ultPesaje.dia : null;
  const gdpStd = ultPesaje && ultPesaje.dia > 0 && pesoStdUlt ? (pesoStdUlt - stdAt(std, 0)) / ultPesaje.dia : null;

  // % cumplimiento vs estándar y metas
  const partes = [];
  if (ultPesaje && pesoStdUlt) partes.push(Math.min(1.1, ultPesaje.peso_g / pesoStdUlt));
  if (fcr && fcrStd) partes.push(Math.min(1.1, fcrStd / fcr));
  const metaMort = (metas.mortalidad_pct || 5.5) * Math.min(1, Math.max(diaActual, 7) / (config.ciclo_dias || 40));
  const pctMort = (ult.mort_acum || 0) / lote.aves_alojadas * 100;
  partes.push(Math.min(1.1, (100 - pctMort) / (100 - metaMort)));
  const cumplimiento = partes.reduce((s, x) => s + x, 0) / partes.length * 100;

  // Capturas pendientes de hoy y alertas
  const hitos = config.dias_hito || [];
  const regHoy = abierto ? (porDia.get(diaActual)?.registrado || new Set()) : new Set();
  const pendientes = [];
  if (abierto) {
    if (!regHoy.has('mortalidad')) pendientes.push('mortalidad');
    if (!regHoy.has('aba')) pendientes.push('aba');
    if (hitos.includes(diaActual) && !regHoy.has('pesaje')) pendientes.push('pesaje');
  }
  const alertas = [];
  if (abierto) {
    const sinCaptura = diffDias(ultimaCaptura, hoy);
    if (sinCaptura >= 2) alertas.push({ nivel: 'alta', tipo: 'sin_captura', texto: `Sin capturas desde hace ${sinCaptura} días` });
    const ayer = dias.find(x => x.dia === diaUltCaptura);
    if (ayer && ayer.pct_mort_dia > 0.3) alertas.push({ nivel: 'alta', tipo: 'mortalidad', texto: `Mortalidad diaria ${ayer.pct_mort_dia}% (día ${ayer.dia})` });
    if (diaActual >= (config.ciclo_dias || 40) - 5) alertas.push({ nivel: 'media', tipo: 'cierre', texto: `Día ${diaActual}: lote por cerrar` });
    const t = [...dias].reverse().find(x => x.temp != null);
    if (t && t.temp >= 32) alertas.push({ nivel: 'media', tipo: 'ambiente', texto: `Temperatura ${t.temp} °C (día ${t.dia})` });
  }
  if (ultPesaje?.dif_peso_pct != null && ultPesaje.dif_peso_pct < -10) alertas.push({ nivel: 'media', tipo: 'peso', texto: `Peso ${ultPesaje.dif_peso_pct}% vs estándar (día ${ultPesaje.dia})` });
  if (fcr && fcrStd && fcr - fcrStd > 0.1) alertas.push({ nivel: 'media', tipo: 'fcr', texto: `Conversión ${r(fcr)} vs estándar ${r(fcrStd)}` });
  if (lote.estado === 'discrepancia') alertas.push({ nivel: 'alta', tipo: 'discrepancia', texto: 'Cierre detenido por discrepancia > tolerancia' });

  const semaforo = lote.estado === 'discrepancia' ? 'critico' : cumplimiento >= 95 ? 'meta' : cumplimiento >= 90 ? 'vigilar' : 'critico';
  const faseAct = (config.fases_aba || []).find(f => diaActual >= f.desde && diaActual <= f.hasta)?.fase || 'engorde';

  return {
    dias, semanas,
    resumen: {
      dia_actual: diaActual, dia_ultima_captura: diaUltCaptura, ultima_captura: ultimaCaptura, fase_aba: faseAct,
      aves_alojadas: lote.aves_alojadas, mort_acum: ult.mort_acum || 0, desc_acum: ult.desc_acum || 0,
      aves_despachadas: avesDesp, kg_despachados: r(kgDesp, 1), saldo: ult.saldo ?? lote.aves_alojadas, vivos_campo: vivosCampo,
      pct_mort: r(pctMort, 2), viabilidad: r(viab, 2), aba_acum_kg: r(ult.aba_acum_kg || 0, 1),
      consumo_ave_g: vivosCampo > 0 ? r((ult.aba_acum_kg || 0) * 1000 / vivosCampo, 0) : null,
      gr_ave_dia: [...dias].reverse().find(x => x.gr_ave_dia != null)?.gr_ave_dia ?? null,
      peso_g: ultPesaje?.peso_g ?? null, dia_peso: ultPesaje?.dia ?? null, peso_std_g: pesoStdUlt, dif_peso_pct: ultPesaje?.dif_peso_pct ?? null,
      peso_prom_kg: r(peso_kg, 3), edad: r(edad, 1), fcr: r(fcr, 3), fcr_std: fcrStd, desv_fcr: fcr && fcrStd ? r(fcr - fcrStd, 3) : null,
      gdp: r(gdp, 1), gdp_std: r(gdpStd, 1), iee: r(iee, 0), cumplimiento: r(cumplimiento, 1), semaforo,
      pendientes, alertas,
    },
  };
}

/** Carga lotes (con permisos) y calcula resumen */
export async function lotesConKpi({ ids = null, granjaIds = null, estado = null, cat = null, detalle = false } = {}) {
  cat ||= await loadCatalogs();
  const cond = [], params = [];
  if (ids) { params.push(ids); cond.push(`l.id = ANY($${params.length})`); }
  if (granjaIds) { params.push(granjaIds); cond.push(`g.id = ANY($${params.length})`); }
  if (estado) { params.push(estado); cond.push(`l.estado = ANY($${params.length})`); }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const lotes = await q(`SELECT l.*, g.id AS granja_id, g.nombre AS granja, g.tipo AS granja_tipo, ga.numero AS galpon, r.nombre AS raza
    FROM lotes l JOIN galpones ga ON ga.id = l.galpon_id JOIN granjas g ON g.id = ga.granja_id JOIN razas r ON r.id = l.raza_id
    ${where} ORDER BY l.estado, l.fecha_entrada DESC`, params);
  if (!lotes.length) return [];
  const lids = lotes.map(l => l.id);
  const [caps, desp] = await Promise.all([
    q(`SELECT lote_id, fecha, tipo, SUM(cantidad) AS cantidad, AVG(peso_g) AS peso_g, AVG(temperatura) AS temperatura, AVG(humedad) AS humedad
       FROM capturas WHERE lote_id = ANY($1) AND NOT anulado GROUP BY lote_id, fecha, tipo`, [lids]),
    q(`SELECT d.*, b.aves_recibidas, b.aves_muertas, b.kg_recibidos, b.kg_tipo_a, b.kg_tipo_b, b.und_tipo_a, b.und_tipo_b, b.fecha AS fecha_beneficio,
         p.nombre AS planta
       FROM despachos d LEFT JOIN beneficios b ON b.despacho_id = d.id LEFT JOIN plantas p ON p.id = d.planta_id
       WHERE d.lote_id = ANY($1) AND NOT d.anulado ORDER BY d.fecha`, [lids]),
  ]);
  return lotes.map(l => {
    const k = calcularLote(l, caps.filter(c => c.lote_id === l.id), desp.filter(d => d.lote_id === l.id), cat);
    const base = { id: l.id, codigo: l.codigo, granja_id: l.granja_id, granja: l.granja, granja_tipo: l.granja_tipo, galpon: l.galpon, galpon_id: l.galpon_id,
      raza: l.raza, raza_id: l.raza_id, incubadora: l.incubadora, fecha_entrada: iso(l.fecha_entrada), aves_alojadas: l.aves_alojadas,
      estado: l.estado, fecha_cierre: l.fecha_cierre ? iso(l.fecha_cierre) : null, observaciones: l.observaciones, demo: l.demo, resumen: k.resumen };
    return detalle ? { ...base, dias: k.dias, semanas: k.semanas, despachos: desp.filter(d => d.lote_id === l.id).map(d => ({ ...d, fecha: iso(d.fecha), fecha_beneficio: d.fecha_beneficio ? iso(d.fecha_beneficio) : null })) } : base;
  });
}
