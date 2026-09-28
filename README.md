# El Dorado · Granjas — Grupo JHS

Plataforma de registro de campo y control de lotes de **pollo de engorde** para Agropecuaria El Dorado (Grupo JHS).

- **App de campo (PWA, offline-first):** galponeros, productores y veterinarios registran mortalidad (por causa y con fotos), descartes, consumo de ABA por fase, pesajes vs. estándar genético, ambiente y salidas de aves. Todo se guarda en el teléfono y se sincroniza al recuperar señal (envíos idempotentes por UUID).
- **Portal de gestión:** dashboard ejecutivo (8 indicadores proyectado vs. ejecutado, semáforo por granja, curvas de peso, comparativos por granja y línea genética), seguimiento de lotes con formato de cuaderno semanal, despachos y recepción en planta beneficiadora, workflow de conciliación con tolerancia del 2 %, estándares genéticos editables, granjas y galpones, usuarios con acceso por granja (RBAC), configuración de metas, auditoría y exportación a Excel / PDF.

## Stack
- Frontend: React + Vite + Tailwind + Recharts, PWA con `vite-plugin-pwa` e IndexedDB (`idb-keyval`).
- Backend: Node.js + Express, API REST en `/api`.
- Base de datos: Neon Postgres (driver HTTP `@neondatabase/serverless`).

## Variables de entorno
Copie `.env.example` a `.env`:
```
DATABASE_URL=postgresql://…/neondb?sslmode=require
JWT_SECRET=una-cadena-larga-aleatoria
PORT=3000
AUTO_SEED=true   # carga catálogos y datos demo si la base está vacía
```

## Ejecutar
```bash
npm install
npm run build      # compila el frontend a dist/
npm start          # aplica el esquema, siembra si hace falta y sirve app + API
```
Desarrollo: `npm run dev` (API en :3999 con `PORT=3999`, Vite en :5173).

## Cálculos clave (server/kpi.js)
| Indicador | Fórmula |
|---|---|
| Saldo de aves | Alojadas − (mortalidad + descartes + salidas) |
| % Mortalidad | Mortalidad acumulada / alojadas × 100 |
| g/ave/día | kg ABA del día × 1000 / aves vivas |
| FCR | kg ABA acumulado / (saldo × peso kg + kg despachados) — desde el día 7 |
| GDP | (peso actual − peso inicial) / días |
| IEE | viabilidad % × peso kg / (edad × FCR) × 100 — desde el día 28 |
| Rendimiento canal | (kg tipo A + tipo B) / kg en pie × 100 |
| Conciliación | \|inventario final campo − aves recibidas\| / inventario final ≤ tolerancia |

## Pendientes de validar con el cliente
- Tablas oficiales Cobb 500 y Ross 308 (cargadas como referencia aproximada, marcadas "por validar").
- Catálogo definitivo de granjas (unión ERS + Excel de agosto; las del Excel están marcadas "por validar").
- Número real de galpones por granja, supervisores y personal.
