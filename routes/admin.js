const express = require('express');
const router = express.Router();
const db = require('../db/database');

// ---------- SEDES ----------
router.get('/sedes', (req, res) => {
  res.json({ sedes: db.prepare('SELECT * FROM sedes').all() });
});

router.post('/sedes', (req, res) => {
  const { nombre, latitud, longitud, radio_metros } = req.body;
  if (!nombre || latitud === undefined || longitud === undefined) {
    return res.status(400).json({ error: 'nombre, latitud y longitud son requeridos' });
  }
  const result = db.prepare(`
    INSERT INTO sedes (nombre, latitud, longitud, radio_metros) VALUES (?, ?, ?, ?)
  `).run(nombre, latitud, longitud, radio_metros || 150);
  res.json({ id: result.lastInsertRowid });
});

// ---------- USUARIOS ----------
router.get('/usuarios', (req, res) => {
  const { rol } = req.query;
  let query = `
    SELECT u.id, u.legajo, u.nombre, u.apellido, u.rol, u.email, u.activo, s.nombre as sede_nombre, u.sede_id
    FROM usuarios u JOIN sedes s ON s.id = u.sede_id
  `;
  const params = [];
  if (rol) { query += ' WHERE u.rol = ?'; params.push(rol); }
  query += ' ORDER BY u.rol, u.apellido';
  res.json({ usuarios: db.prepare(query).all(...params) });
});

router.post('/usuarios', (req, res) => {
  const { legajo, nombre, apellido, rol, email, pin, sede_id } = req.body;
  if (!legajo || !nombre || !apellido || !rol || !sede_id) {
    return res.status(400).json({ error: 'legajo, nombre, apellido, rol y sede_id son requeridos' });
  }
  if (!['administrativo', 'docente', 'alumno'].includes(rol)) {
    return res.status(400).json({ error: 'rol inválido' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO usuarios (legajo, nombre, apellido, rol, email, pin, sede_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(legajo, nombre, apellido, rol, email || null, pin || '1234', sede_id);
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'No se pudo crear el usuario (¿legajo duplicado?)', detalle: e.message });
  }
});

router.put('/usuarios/:id/estado', (req, res) => {
  const { activo } = req.body;
  db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(activo ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
