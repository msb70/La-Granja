import './db.js';
import express from 'express';
import compression from 'compression';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import api from './api.js';
import { migrate } from './migrate.js';
import { seed } from './seed.js';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '25mb' }));

app.get('/api/salud', (req, res) => res.json({ ok: true, hora: new Date().toISOString() }));
app.use('/api', api);

if (existsSync(dist)) {
  app.use(express.static(dist, {
    setHeaders: (res, p) => {
      if (p.endsWith('sw.js') || p.endsWith('.html') || p.endsWith('manifest.webmanifest')) res.setHeader('Cache-Control', 'no-cache');
      else if (p.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(join(dist, 'index.html')));
} else {
  app.get('/', (req, res) => res.send('Frontend no compilado. Ejecute npm run build.'));
}

const port = process.env.PORT || 3000;
(async () => {
  try {
    await migrate();
    if (process.env.AUTO_SEED !== 'false') await seed();
  } catch (e) { console.error('Error preparando la base de datos:', e.message); }
  app.listen(port, () => console.log(`El Dorado · Granjas escuchando en :${port}`));
})();
