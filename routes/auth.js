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

module.exports = router;
