import { Skull, ShieldAlert, Wheat, Scale, Thermometer, Truck } from 'lucide-react';

export const MODULOS = {
  mortalidad: { titulo: 'Mortalidad', icon: Skull, bg: 'bg-mort-500', soft: 'bg-mort-50', text: 'text-mort-700', ring: 'ring-mort-500', color: '#E5484D' },
  descarte: { titulo: 'Descarte', icon: ShieldAlert, bg: 'bg-desc-500', soft: 'bg-desc-50', text: 'text-desc-700', ring: 'ring-desc-500', color: '#F5A524' },
  aba: { titulo: 'Alimento ABA', icon: Wheat, bg: 'bg-aba-500', soft: 'bg-aba-50', text: 'text-aba-700', ring: 'ring-aba-500', color: '#3FA34D' },
  pesaje: { titulo: 'Pesaje', icon: Scale, bg: 'bg-peso-500', soft: 'bg-peso-50', text: 'text-peso-700', ring: 'ring-peso-500', color: '#27AAE1' },
  ambiente: { titulo: 'Ambiente', icon: Thermometer, bg: 'bg-amb-500', soft: 'bg-amb-50', text: 'text-amb-700', ring: 'ring-amb-500', color: '#8E6CEF' },
  despacho: { titulo: 'Salida de aves', icon: Truck, bg: 'bg-desp-500', soft: 'bg-desp-50', text: 'text-desp-700', ring: 'ring-desp-500', color: '#14B8A6' },
};

export const CAUSAS_MORT = [
  { v: 'patologica', t: 'Patológica' }, { v: 'ambiental', t: 'Ambiental' }, { v: 'mecanica', t: 'Mecánica' }, { v: 'otra', t: 'Otra / sin clasificar' },
];
export const MOTIVOS_DESC = ['Bajo desarrollo', 'Problema de patas', 'Lesión', 'Otro'];
export const FASES = { preinicio: 'Pre-inicio', inicio: 'Inicio', engorde: 'Engorde / Terminador' };
export const faseDe = (dia, fases = []) => fases.find(f => dia >= f.desde && dia <= f.hasta)?.fase || (dia <= 10 ? 'preinicio' : dia <= 18 ? 'inicio' : 'engorde');
