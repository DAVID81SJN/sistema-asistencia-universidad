const db = require('../db/database');

function getConfig() {
  const filas = db.prepare('SELECT clave, valor FROM configuracion').all();
  const config = {};
  filas.forEach(f => { config[f.clave] = f.valor; });
  return config;
}

function setConfig(clave, valor) {
  db.prepare(`
    INSERT INTO configuracion (clave, valor) VALUES (?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor
  `).run(clave, String(valor));
}

module.exports = { getConfig, setConfig };
