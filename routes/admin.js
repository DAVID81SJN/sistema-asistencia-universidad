const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { getConfig, setConfig } = require('../utils/config');

// Código único de acceso al panel del administrador principal.
// Se puede sobreescribir con la variable de entorno ADMIN_CODE en Railway.
const ADMIN_CODE = process.env.ADMIN_CODE || '1112';

// POST /api/admin/login { codigo }
router.post('/login', (req, res) => {
  const { codigo } = req.body;
  if (codigo === ADMIN_CODE) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Código de acceso incorrecto.' });
});

// ---------- CONFIGURACIÓN GENERAL ----------
router.get('/config', (req, res) => {
  res.json({ config: getConfig() });
});

router.put('/config', (req, res) => {
  const permitidas = [
    'hora_entrada_esperada', 'hora_salida_esperada', 'tolerancia_minutos',
    'permitir_registro_alumnos', 'nombre_institucion', 'nombre_sede',
    'plan_tipo', 'plan_fecha_renovacion'
  ];
  Object.entries(req.body).forEach(([clave, valor]) => {
    if (permitidas.includes(clave)) setConfig(clave, valor);
  });
  res.json({ ok: true, config: getConfig() });
});

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

router.put('/sedes/:id', (req, res) => {
  const { nombre, latitud, longitud, radio_metros } = req.body;
  if (latitud === undefined || longitud === undefined || !radio_metros) {
    return res.status(400).json({ error: 'latitud, longitud y radio_metros son requeridos' });
  }
  const sede = db.prepare('SELECT * FROM sedes WHERE id = ?').get(req.params.id);
  if (!sede) return res.status(404).json({ error: 'Sede no encontrada' });

  db.prepare(`
    UPDATE sedes SET nombre = ?, latitud = ?, longitud = ?, radio_metros = ? WHERE id = ?
  `).run(nombre || sede.nombre, latitud, longitud, radio_metros, req.params.id);

  res.json({ ok: true });
});

// ---------- USUARIOS ----------
router.get('/usuarios', (req, res) => {
  const { rol } = req.query;
  let query = `
    SELECT u.id, u.legajo, u.nombre, u.apellido, u.rol, u.email, u.pin, u.activo,
           u.device_token, u.device_vinculado_en, s.nombre as sede_nombre, u.sede_id
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

router.put('/usuarios/:id/pin', (req, res) => {
  const { pin } = req.body;
  if (!/^\d{4}$/.test(pin || '')) {
    return res.status(400).json({ error: 'La contraseña debe ser de 4 dígitos.' });
  }
  db.prepare('UPDATE usuarios SET pin = ? WHERE id = ?').run(pin, req.params.id);
  res.json({ ok: true });
});

router.put('/usuarios/:id/desvincular-dispositivo', (req, res) => {
  db.prepare('UPDATE usuarios SET device_token = NULL, device_vinculado_en = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// DELETE /api/admin/usuarios/:id  -> elimina un usuario y su historial de asistencia
router.delete('/usuarios/:id', (req, res) => {
  const id = req.params.id;
  db.prepare('DELETE FROM asistencias WHERE usuario_id = ?').run(id);
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  res.json({ ok: true });
});

// DELETE /api/admin/usuarios-demo -> elimina de un solo clic a los 7 usuarios de ejemplo
// (los que tienen legajo ADM-xxx, DOC-xxx o ALU-xxx creados por el seed inicial)
router.delete('/usuarios-demo', (req, res) => {
  const demo = db.prepare(`
    SELECT id FROM usuarios WHERE legajo LIKE 'ADM-%' OR legajo LIKE 'DOC-%' OR legajo LIKE 'ALU-%'
  `).all();
  const ids = demo.map(u => u.id);
  ids.forEach(id => {
    db.prepare('DELETE FROM asistencias WHERE usuario_id = ?').run(id);
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  });
  res.json({ ok: true, eliminados: ids.length });
});

module.exports = router;
