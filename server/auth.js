import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { q } from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar';
export const ROLES_GLOBALES = ['admin', 'gerencia', 'coordinacion'];

export const ROL_NOMBRE = {
  admin: 'Administrador', gerencia: 'Gerencia', coordinacion: 'Coordinación Central',
  veterinario: 'Inspector / Veterinario', productor: 'Productor Integrado', galponero: 'Galponero / Operario',
};

export async function login(username, password) {
  const [u] = await q('SELECT * FROM usuarios WHERE lower(username) = lower($1) AND activo', [username]);
  if (!u || !(await bcrypt.compare(password, u.password_hash))) return null;
  const token = jwt.sign({ id: u.id, rol: u.rol }, SECRET, { expiresIn: '30d' });
  return { token, usuario: await perfil(u.id) };
}

export async function perfil(id) {
  const [u] = await q('SELECT id, username, nombre, rol FROM usuarios WHERE id=$1 AND activo', [id]);
  if (!u) return null;
  u.rol_nombre = ROL_NOMBRE[u.rol];
  u.global = ROLES_GLOBALES.includes(u.rol);
  u.granjas = u.global ? null : (await q('SELECT granja_id FROM usuario_granjas WHERE usuario_id=$1', [id])).map(r => r.granja_id);
  return u;
}

/** Middleware: exige sesión válida */
export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : req.query.token;
  if (!token) return res.status(401).json({ error: 'Sesión requerida' });
  try {
    const p = jwt.verify(token, SECRET);
    perfil(p.id).then(u => {
      if (!u) return res.status(401).json({ error: 'Usuario inactivo' });
      req.user = u; next();
    }).catch(next);
  } catch { return res.status(401).json({ error: 'Sesión expirada' }); }
}

/** Middleware: exige uno de los roles */
export const requireRol = (...roles) => (req, res, next) =>
  roles.includes(req.user.rol) || req.user.rol === 'admin' ? next() : res.status(403).json({ error: 'No tiene permiso para esta acción' });

/** ¿Puede el usuario ver/operar la granja? */
export const puedeGranja = (user, granjaId) => user.global || user.granjas.includes(Number(granjaId));

export async function granjaDeLote(loteId) {
  const [r] = await q('SELECT ga.granja_id, l.estado FROM lotes l JOIN galpones ga ON ga.id=l.galpon_id WHERE l.id=$1', [loteId]);
  return r;
}
