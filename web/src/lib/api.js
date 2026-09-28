// Cliente de la API + almacenamiento offline (IndexedDB) + cola de sincronización
import { get, set, del } from 'idb-keyval';

const TOKEN_KEY = 'jhs_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }

export async function api(path, { method = 'GET', body, raw } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Sin conexión con el servidor', 0);
  }
  if (res.status === 401 && path !== '/auth/login') { setToken(null); window.dispatchEvent(new Event('jhs:logout')); }
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Error ' + res.status, res.status);
  return data;
}

export const descargar = (path) => { window.location.href = '/api' + path + (path.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(getToken()); };
export const fotoUrl = (id) => `/api/fotos/${id}?token=${encodeURIComponent(getToken())}`;

// ---------- utilidades ----------
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }));
export const hoy = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10); // Venezuela (UTC-4)
export const diffDias = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400e3);
export const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const fmt = (v, d = 0) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('es-VE', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const fmtFecha = (iso, opts = { day: '2-digit', month: 'short' }) => (iso ? new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('es-VE', { timeZone: 'UTC', ...opts }) : '—');

export function stdAt(puntos = [], dia, campo = 'peso_g') {
  const pts = puntos.filter(p => p[campo] != null).sort((a, b) => a.dia - b.dia);
  if (!pts.length) return null;
  if (dia <= pts[0].dia) return +pts[0][campo];
  for (let i = 1; i < pts.length; i++) if (dia <= pts[i].dia) {
    const a = pts[i - 1], b = pts[i]; return +a[campo] + (+b[campo] - +a[campo]) * (dia - a.dia) / (b.dia - a.dia);
  }
  return +pts[pts.length - 1][campo];
}

/** Reduce una foto a JPEG ~1280px para ahorrar datos */
export function comprimirFoto(file, max = 1280, calidad = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', calidad));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ---------- caché offline ----------
const BOOT = 'jhs_bootstrap', OUTBOX = 'jhs_outbox';
export const getBootstrap = () => get(BOOT);
export async function refreshBootstrap() {
  const b = await api('/bootstrap');
  await set(BOOT, b);
  return b;
}
export async function clearLocal() { await del(BOOT); }

/** Cola de envíos pendientes: [{ kind: 'captura'|'despacho'|'foto', id, payload, estado, error, creado }] */
export const getOutbox = async () => (await get(OUTBOX)) || [];
const setOutbox = async (items) => { await set(OUTBOX, items); window.dispatchEvent(new Event('jhs:outbox')); };
export async function encolar(kind, payload) {
  const items = await getOutbox();
  items.push({ kind, id: payload.id, payload, estado: 'pendiente', error: null, creado: new Date().toISOString() });
  await setOutbox(items);
  sincronizar().catch(() => {});
}
export async function descartar(id) { await setOutbox((await getOutbox()).filter(i => i.id !== id)); }

let sincronizando = null;
/** Envía la cola al servidor. Idempotente: el servidor ignora IDs repetidos. */
export function sincronizar() {
  if (sincronizando) return sincronizando;
  sincronizando = (async () => {
    const items = (await getOutbox()).filter(i => i.estado !== 'error');
    if (!items.length || !navigator.onLine || !getToken()) return { enviados: 0 };
    const body = { capturas: [], despachos: [], fotos: [] };
    for (const i of items) body[i.kind === 'captura' ? 'capturas' : i.kind === 'despacho' ? 'despachos' : 'fotos'].push(i.payload);
    // Fotos en lotes pequeños para no exceder el tamaño de la petición
    const fotos = body.fotos; body.fotos = [];
    const r = await api('/sync', { method: 'POST', body });
    for (let k = 0; k < fotos.length; k += 4) {
      const rf = await api('/sync', { method: 'POST', body: { fotos: fotos.slice(k, k + 4) } });
      Object.assign(r.fotos, rf.fotos);
    }
    const res = { ...r.capturas, ...r.despachos, ...r.fotos };
    const actual = await getOutbox();
    const nuevo = actual.flatMap(i => {
      const x = res[i.id];
      if (!x) return [i];
      if (x.ok) return [];
      return [{ ...i, estado: 'error', error: x.error }];
    });
    await setOutbox(nuevo);
    const enviados = actual.length - nuevo.length;
    if (enviados) await refreshBootstrap().catch(() => {});
    window.dispatchEvent(new CustomEvent('jhs:sync', { detail: { enviados, errores: nuevo.filter(i => i.estado === 'error').length } }));
    return { enviados };
  })().finally(() => { sincronizando = null; });
  return sincronizando;
}
export async function reintentar(id) {
  await setOutbox((await getOutbox()).map(i => (i.id === id ? { ...i, estado: 'pendiente', error: null } : i)));
  return sincronizar();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => sincronizar().catch(() => {}));
  setInterval(() => sincronizar().catch(() => {}), 60_000);
}

/** Aplica al resumen de un lote las capturas que aún están en la cola (vista optimista offline) */
export function conPendientes(lote, outbox, fecha = hoy()) {
  if (!lote) return lote;
  const mias = outbox.filter(i => Number(i.payload.lote_id) === lote.id && i.estado !== 'error');
  if (!mias.length) return { ...lote, pendientesLocales: 0, hoyLocal: {} };
  const r = { ...lote.resumen };
  const hoyLocal = {};
  for (const { kind, payload: p } of mias) {
    if (kind === 'captura') {
      if (p.tipo === 'mortalidad') { r.mort_acum += p.cantidad; r.saldo -= p.cantidad; }
      if (p.tipo === 'descarte') { r.desc_acum += p.cantidad; r.saldo -= p.cantidad; }
      if (p.tipo === 'aba') r.aba_acum_kg += p.cantidad;
      if (p.tipo === 'pesaje') { r.peso_g = p.peso_g; r.dia_peso = diffDias(lote.fecha_entrada, p.fecha); }
      if (p.fecha === fecha) { hoyLocal[p.tipo] = (hoyLocal[p.tipo] || 0) + (p.cantidad ?? 1); r.pendientes = (r.pendientes || []).filter(t => t !== p.tipo); }
    }
    if (kind === 'despacho') { r.saldo -= p.aves; r.aves_despachadas += p.aves; }
  }
  r.pct_mort = +(r.mort_acum / lote.aves_alojadas * 100).toFixed(2);
  return { ...lote, resumen: r, pendientesLocales: mias.length, hoyLocal };
}
