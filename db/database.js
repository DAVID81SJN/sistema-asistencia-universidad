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
      FOREIGN KEY (sede_id) REFERENCES sedes(id)
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
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (sede_id) REFERENCES sedes(id)
    );

    CREATE INDEX IF NOT EXISTS idx_asistencias_usuario_fecha ON asistencias(usuario_id, fecha);
  `);
}

init();

module.exports = db;
