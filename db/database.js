const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'asistencia.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sedes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      latitud REAL NOT NULL,
      longitud REAL NOT NULL,
      radio_metros REAL NOT NULL DEFAULT 150
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legajo TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('administrativo','docente','alumno')),
      email TEXT,
      pin TEXT NOT NULL DEFAULT '1234',
      sede_id INTEGER NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      device_token TEXT,
      device_vinculado_en TEXT,
      FOREIGN KEY (sede_id) REFERENCES sedes(id)
    );

    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS asistencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      sede_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      ingreso_ts TEXT,
      ingreso_lat REAL,
      ingreso_lng REAL,
      ingreso_precision REAL,
      ingreso_distancia_m REAL,
      salida_ts TEXT,
      salida_lat REAL,
      salida_lng REAL,
      salida_precision REAL,
      salida_distancia_m REAL,
      minutos_trabajados REAL,
      estado TEXT NOT NULL DEFAULT 'abierta' CHECK(estado IN ('abierta','cerrada')),
      observacion TEXT,
      ingreso_foto TEXT,
      salida_foto TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (sede_id) REFERENCES sedes(id)
    );

    CREATE INDEX IF NOT EXISTS idx_asistencias_usuario_fecha ON asistencias(usuario_id, fecha);
  `);

  // Migración segura para bases de datos que ya existían antes de esta versión
  // (agrega columnas nuevas sin borrar nada de lo que ya había).
  const columnas = db.prepare(`PRAGMA table_info(usuarios)`).all().map(c => c.name);
  if (!columnas.includes('device_token')) {
    db.exec(`ALTER TABLE usuarios ADD COLUMN device_token TEXT`);
  }
  if (!columnas.includes('device_vinculado_en')) {
    db.exec(`ALTER TABLE usuarios ADD COLUMN device_vinculado_en TEXT`);
  }
  const columnasAsistencias = db.prepare(`PRAGMA table_info(asistencias)`).all().map(c => c.name);
  if (!columnasAsistencias.includes('ingreso_foto')) {
    db.exec(`ALTER TABLE asistencias ADD COLUMN ingreso_foto TEXT`);
  }
  if (!columnasAsistencias.includes('salida_foto')) {
    db.exec(`ALTER TABLE asistencias ADD COLUMN salida_foto TEXT`);
  }

  // Configuración por defecto (solo si no existe todavía)
  const insertConfigDefault = db.prepare(`INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)`);
  insertConfigDefault.run('hora_entrada_esperada', '08:00');
  insertConfigDefault.run('hora_salida_esperada', '17:00');
  insertConfigDefault.run('tolerancia_minutos', '10');
  insertConfigDefault.run('permitir_registro_alumnos', '0');
  insertConfigDefault.run('nombre_institucion', 'Universidad Privada del Guairá');
  insertConfigDefault.run('nombre_sede', 'Sede San Juan Nepomuceno');
}

init();

module.exports = db;
