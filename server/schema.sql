-- El Dorado · Granjas (Grupo JHS) — esquema de base de datos
-- Idempotente: se puede ejecutar varias veces.

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  nombre        TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL CHECK (rol IN ('admin','gerencia','coordinacion','veterinario','productor','galponero')),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS granjas (
  id           SERIAL PRIMARY KEY,
  nombre       TEXT UNIQUE NOT NULL,
  tipo         TEXT NOT NULL DEFAULT 'propia' CHECK (tipo IN ('propia','tercero')),
  ubicacion    TEXT,
  supervisor   TEXT,
  origen_dato  TEXT,           -- de dónde salió el registro (ERS, Excel agosto...)
  por_validar  BOOLEAN NOT NULL DEFAULT FALSE,
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS galpones (
  id         SERIAL PRIMARY KEY,
  granja_id  INT NOT NULL REFERENCES granjas(id) ON DELETE CASCADE,
  numero     INT NOT NULL,
  capacidad  INT,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (granja_id, numero)
);

CREATE TABLE IF NOT EXISTS usuario_granjas (
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  granja_id  INT NOT NULL REFERENCES granjas(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, granja_id)
);

CREATE TABLE IF NOT EXISTS razas (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT UNIQUE NOT NULL,
  fuente      TEXT,
  por_validar BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS estandares (
  raza_id  INT NOT NULL REFERENCES razas(id) ON DELETE CASCADE,
  dia      INT NOT NULL,
  peso_g   NUMERIC,
  fcr      NUMERIC,
  PRIMARY KEY (raza_id, dia)
);

CREATE TABLE IF NOT EXISTS incubadoras (
  id     SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS plantas (
  id     SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS lotes (
  id              SERIAL PRIMARY KEY,
  codigo          TEXT UNIQUE NOT NULL,
  galpon_id       INT NOT NULL REFERENCES galpones(id),
  raza_id         INT NOT NULL REFERENCES razas(id),
  incubadora      TEXT,
  fecha_entrada   DATE NOT NULL,
  aves_alojadas   INT NOT NULL CHECK (aves_alojadas > 0),
  peso_inicial_g  NUMERIC DEFAULT 42,
  estado          TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','cerrado','discrepancia')),
  fecha_cierre    DATE,
  observaciones   TEXT,
  demo            BOOLEAN NOT NULL DEFAULT FALSE,
  creado_por      INT REFERENCES usuarios(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lotes_galpon_idx ON lotes(galpon_id);

-- Capturas de campo: eventos append-only con UUID generado en el dispositivo (sincronización idempotente)
CREATE TABLE IF NOT EXISTS capturas (
  id             UUID PRIMARY KEY,
  lote_id        INT NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  fecha          DATE NOT NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN ('mortalidad','descarte','aba','pesaje','ambiente')),
  cantidad       NUMERIC,          -- aves (mortalidad/descarte) o kg (aba)
  causa          TEXT,             -- patologica | ambiental | mecanica | otra (mortalidad) / motivo (descarte)
  fase           TEXT,             -- preinicio | inicio | engorde (aba)
  peso_g         NUMERIC,          -- pesaje: peso promedio de la muestra
  muestra        INT,              -- pesaje: nº de aves pesadas
  temperatura    NUMERIC,          -- ambiente
  humedad        NUMERIC,
  observaciones  TEXT,
  anulado        BOOLEAN NOT NULL DEFAULT FALSE,
  anulado_por    INT REFERENCES usuarios(id),
  usuario_id     INT REFERENCES usuarios(id),
  capturado_en   TIMESTAMPTZ,      -- hora en el dispositivo
  sincronizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS capturas_lote_idx ON capturas(lote_id, fecha);

CREATE TABLE IF NOT EXISTS fotos (
  id          UUID PRIMARY KEY,
  captura_id  UUID,
  lote_id     INT REFERENCES lotes(id) ON DELETE CASCADE,
  ref_tipo    TEXT,             -- captura | discrepancia | despacho
  ref_id      TEXT,
  mime        TEXT NOT NULL,
  data        BYTEA NOT NULL,
  usuario_id  INT REFERENCES usuarios(id),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fotos_ref_idx ON fotos(ref_tipo, ref_id);

CREATE TABLE IF NOT EXISTS validaciones_dia (
  lote_id       INT NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL,
  validado_por  INT REFERENCES usuarios(id),
  validado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lote_id, fecha)
);

-- Salidas de aves: a planta beneficiadora o venta en pie
CREATE TABLE IF NOT EXISTS despachos (
  id             UUID PRIMARY KEY,
  lote_id        INT NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  fecha          DATE NOT NULL,
  destino        TEXT NOT NULL CHECK (destino IN ('planta','venta_pie')),
  planta_id      INT REFERENCES plantas(id),
  cliente        TEXT,
  aves           INT NOT NULL CHECK (aves > 0),
  kg_pie         NUMERIC NOT NULL CHECK (kg_pie > 0),
  placa          TEXT,
  flete          NUMERIC,
  observaciones  TEXT,
  anulado        BOOLEAN NOT NULL DEFAULT FALSE,
  usuario_id     INT REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS despachos_lote_idx ON despachos(lote_id);

-- Recepción en planta beneficiadora
CREATE TABLE IF NOT EXISTS beneficios (
  despacho_id      UUID PRIMARY KEY REFERENCES despachos(id) ON DELETE CASCADE,
  fecha            DATE NOT NULL,
  aves_recibidas   INT NOT NULL,
  aves_muertas     INT NOT NULL DEFAULT 0,
  kg_recibidos     NUMERIC NOT NULL,
  und_tipo_a       INT, kg_tipo_a NUMERIC,
  und_tipo_b       INT, kg_tipo_b NUMERIC,
  usuario_id       INT REFERENCES usuarios(id),
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workflow de discrepancia (tolerancia 2%)
CREATE TABLE IF NOT EXISTS discrepancias (
  id              SERIAL PRIMARY KEY,
  lote_id         INT NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  aves_esperadas  INT NOT NULL,
  aves_recibidas  INT NOT NULL,
  diferencia      INT NOT NULL,
  porcentaje      NUMERIC NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','justificada','aprobada','rechazada')),
  informe         TEXT,
  informe_por     INT REFERENCES usuarios(id),
  informe_en      TIMESTAMPTZ,
  resolucion      TEXT,
  resuelto_por    INT REFERENCES usuarios(id),
  resuelto_en     TIMESTAMPTZ,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auditoria (
  id          BIGSERIAL PRIMARY KEY,
  usuario_id  INT REFERENCES usuarios(id),
  accion      TEXT NOT NULL,
  entidad     TEXT,
  entidad_id  TEXT,
  detalle     JSONB,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
