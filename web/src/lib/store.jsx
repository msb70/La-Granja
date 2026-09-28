import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken, getBootstrap, refreshBootstrap, getOutbox, sincronizar, clearLocal } from './api.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export const ROLES_PANEL = ['admin', 'gerencia', 'coordinacion', 'veterinario', 'productor'];
export const puede = (user, ...roles) => !!user && (user.rol === 'admin' || roles.includes(user.rol));

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [boot, setBoot] = useState(null);
  const [outbox, setOutbox] = useState([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState(null);

  const aviso = useCallback((texto, tipo = 'ok') => { setToast({ texto, tipo, id: Date.now() }); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3800); return () => clearTimeout(t); }, [toast]);

  const recargar = useCallback(async () => {
    try { const b = await refreshBootstrap(); setBoot(b); setUser(b.usuario); return b; }
    catch (e) { const b = await getBootstrap(); if (b) { setBoot(b); setUser(b.usuario); } if (e.status === 401) throw e; return b; }
  }, []);

  useEffect(() => {
    (async () => {
      const cached = await getBootstrap();
      if (getToken() && cached) { setBoot(cached); setUser(cached.usuario); }
      setOutbox(await getOutbox());
      if (getToken()) await recargar().catch(() => {});
      setCargando(false);
      sincronizar().catch(() => {});
    })();
    const upOut = async () => setOutbox(await getOutbox());
    const upBoot = async () => { const b = await getBootstrap(); if (b) setBoot(b); };
    const on = () => setOnline(true), off = () => setOnline(false);
    const logout = () => { setUser(null); setBoot(null); };
    window.addEventListener('jhs:outbox', upOut);
    window.addEventListener('jhs:sync', upBoot);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    window.addEventListener('jhs:logout', logout);
    return () => { window.removeEventListener('jhs:outbox', upOut); window.removeEventListener('jhs:sync', upBoot); window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('jhs:logout', logout); };
  }, [recargar]);

  const login = async (username, password) => {
    const r = await api('/auth/login', { method: 'POST', body: { username, password } });
    setToken(r.token); setUser(r.usuario);
    await recargar();
    return r.usuario;
  };
  const logout = async () => {
    const pend = (await getOutbox()).length;
    if (pend && !confirm(`Hay ${pend} registro(s) sin sincronizar en este dispositivo. Si cierra sesión se conservarán, pero no se enviarán hasta que vuelva a entrar. ¿Continuar?`)) return;
    setToken(null); await clearLocal(); setUser(null); setBoot(null);
  };

  return <Ctx.Provider value={{ user, boot, outbox, online, cargando, login, logout, recargar, aviso, toast }}>{children}</Ctx.Provider>;
}
