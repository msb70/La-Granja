process.env.TZ = 'UTC'; // fechas DATE sin desplazamientos de zona horaria
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en el entorno');
}
export const sql = neon(process.env.DATABASE_URL || 'postgresql://x:x@localhost/x');

/** Ejecuta una consulta con parámetros posicionales ($1, $2...) */
export const q = (text, params = []) => sql.query(text, params);

/** Ejecuta varias consultas en una transacción: [[text, params], ...] */
export const tx = (items) => sql.transaction(items.map(([t, p]) => sql.query(t, p || [])));

export async function audit(usuarioId, accion, entidad, entidadId, detalle) {
  try {
    await q('INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle) VALUES ($1,$2,$3,$4,$5)',
      [usuarioId || null, accion, entidad, entidadId != null ? String(entidadId) : null, detalle ? JSON.stringify(detalle) : null]);
  } catch (e) { console.error('auditoria', e.message); }
}
