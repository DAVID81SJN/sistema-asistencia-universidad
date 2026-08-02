const express = require('express');
const router = express.Router();
const db = require('../db/database');

// POST /api/auth/login  { legajo, pin }
router.post('/login', (req, res) => {
  const { legajo, pin } = req.body;
  if (!legajo || !pin) {
    return res.status(400).json({ error: 'legajo y pin son requeridos' });
  }

  const usuario = db.prepare(`
    SELECT u.*, s.nombre AS sede_nombre, s.latitud, s.longitud, s.radio_metros
    FROM usuarios u
    JOIN sedes s ON s.id = u.sede_id
    WHERE u.legajo = ? AND u.activo = 1
  `).get(legajo);

  if (!usuario || usuario.pin !== pin) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  delete usuario.pin;
  res.json({ usuario });
});

// POST /api/auth/registro
// { nombre_completo, documento, rol, pin, pin_confirm }
// Alta propia: cada persona se registra la primera vez con su documento como usuario.
router.post('/registro', (req, res) => {
  const { nombre_completo, documento, rol, pin, pin_confirm } = req.body;

  if (!nombre_completo || !documento || !rol || !pin || !pin_confirm) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }
  if (!['administrativo', 'docente', 'alumno'].includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido.' });
  }
  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'La contraseña debe ser de exactamente 4 dígitos.' });
  }
  if (pin !== pin_confirm) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden.' });
  }

  const documentoLimpio = documento.trim();
  const existente = db.prepare('SELECT id FROM usuarios WHERE legajo = ?').get(documentoLimpio);
  if (existente) {
    return res.status(400).json({ error: 'Ya existe un usuario registrado con ese número de documento.' });
  }

  const sede = db.prepare('SELECT id FROM sedes ORDER BY id LIMIT 1').get();
  if (!sede) {
    return res.status(500).json({ error: 'No hay ninguna sede configurada todavía. Contactá al administrador.' });
  }

  const result = db.prepare(`
    INSERT INTO usuarios (legajo, nombre, apellido, rol, pin, sede_id)
    VALUES (?, ?, '', ?, ?, ?)
  `).run(documentoLimpio, nombre_completo.trim(), rol, pin, sede.id);

  res.json({ ok: true, id: result.lastInsertRowid, mensaje: 'Registro exitoso. Ya podés marcar tu asistencia con tu documento y contraseña.' });
});

module.exports = router;
