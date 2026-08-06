const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { estaDentroDeSede } = require('../utils/geofence');

function hoyISO() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// GET /api/asistencia/estado/:usuarioId -> registro abierto de hoy (si existe)
router.get('/estado/:usuarioId', (req, res) => {
  const { usuarioId } = req.params;
  const fecha = hoyISO();

  const registro = db.prepare(`
    SELECT * FROM asistencias WHERE usuario_id = ? AND fecha = ? ORDER BY id DESC LIMIT 1
  `).get(usuarioId, fecha);

  res.json({ registro: registro || null });
});

// POST /api/asistencia/marcar { usuario_id, lat, lng, precision }
// Decide automáticamente si corresponde INGRESO o SALIDA según el estado del día.
router.post('/marcar', (req, res) => {
  const { usuario_id, lat, lng, precision } = req.body;

  if (!usuario_id || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'usuario_id, lat y lng son requeridos' });
  }

  const usuario = db.prepare(`
    SELECT u.*, s.nombre AS sede_nombre, s.latitud, s.longitud, s.radio_metros, s.id as sede_id_real
    FROM usuarios u JOIN sedes s ON s.id = u.sede_id
    WHERE u.id = ? AND u.activo = 1
  `).get(usuario_id);

  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

  const sede = {
    latitud: usuario.latitud,
    longitud: usuario.longitud,
    radio_metros: usuario.radio_metros,
  };

  const { dentro, distancia } = estaDentroDeSede(parseFloat(lat), parseFloat(lng), sede);

  if (!dentro) {
    return res.status(403).json({
      error: `Fuera del rango permitido de "${usuario.sede_nombre}". Distancia: ${distancia} m (máximo ${sede.radio_metros} m).`,
      distancia,
      radio_permitido: sede.radio_metros,
    });
  }

  const fecha = hoyISO();
  const ahora = new Date().toISOString();

  const abierta = db.prepare(`
    SELECT * FROM asistencias WHERE usuario_id = ? AND fecha = ? AND estado = 'abierta'
    ORDER BY id DESC LIMIT 1
  `).get(usuario_id, fecha);

  if (!abierta) {
    // Registrar INGRESO
    const result = db.prepare(`
      INSERT INTO asistencias
        (usuario_id, sede_id, fecha, ingreso_ts, ingreso_lat, ingreso_lng, ingreso_precision, ingreso_distancia_m, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'abierta')
    `).run(usuario_id, usuario.sede_id_real, fecha, ahora, lat, lng, precision || null, distancia);

    return res.json({
      tipo: 'ingreso',
      mensaje: `Ingreso registrado para ${usuario.nombre} ${usuario.apellido} a las ${ahora}`,
      registro_id: result.lastInsertRowid,
      distancia_m: distancia,
    });
  } else {
    // Registrar SALIDA y cerrar el registro
    const minutos = (new Date(ahora) - new Date(abierta.ingreso_ts)) / 60000;

    db.prepare(`
      UPDATE asistencias
      SET salida_ts = ?, salida_lat = ?, salida_lng = ?, salida_precision = ?,
          salida_distancia_m = ?, minutos_trabajados = ?, estado = 'cerrada'
      WHERE id = ?
    `).run(ahora, lat, lng, precision || null, distancia, Math.round(minutos * 100) / 100, abierta.id);

    return res.json({
      tipo: 'salida',
      mensaje: `Salida registrada para ${usuario.nombre} ${usuario.apellido} a las ${ahora}`,
      registro_id: abierta.id,
      minutos_trabajados: Math.round(minutos * 100) / 100,
      distancia_m: distancia,
    });
  }
});

// POST /api/asistencia/marcar-login { legajo, password, lat, lng, precision, device_token }
// Autentica Y marca en un mismo paso. Se usa tanto para el ingreso como para la
// salida: la persona debe volver a escribir usuario y contraseña las dos veces,
// y en ambos casos debe seguir estando dentro del radio del campus.
// Además valida que el dispositivo (device_token) sea el mismo que quedó
// vinculado la primera vez que la persona marcó, para evitar que otra persona
// use el link desde otro celular en su nombre.
router.post('/marcar-login', (req, res) => {
  const { legajo, password, lat, lng, precision, device_token, foto_base64 } = req.body;

  if (!legajo || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'No se pudo obtener tu ubicación GPS. Activá el GPS e intentá de nuevo.' });
  }
  if (!device_token) {
    return res.status(400).json({ error: 'No se pudo identificar el dispositivo. Recargá la página e intentá de nuevo.' });
  }
  if (!foto_base64) {
    return res.status(400).json({ error: 'Falta la foto de verificación. Dale permiso de cámara y volvé a intentar.' });
  }

  const usuario = db.prepare(`
    SELECT u.*, s.nombre AS sede_nombre, s.latitud, s.longitud, s.radio_metros, s.id as sede_id_real
    FROM usuarios u JOIN sedes s ON s.id = u.sede_id
    WHERE u.legajo = ? AND u.activo = 1
  `).get(legajo);

  if (!usuario || usuario.pin !== password) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  // --- Validación de dispositivo vinculado ---
  if (!usuario.device_token) {
    // Primera vez que este usuario marca: queda vinculado a este dispositivo.
    db.prepare(`UPDATE usuarios SET device_token = ?, device_vinculado_en = ? WHERE id = ?`)
      .run(device_token, new Date().toISOString(), usuario.id);
  } else if (usuario.device_token !== device_token) {
    return res.status(403).json({
      error: `Tu usuario ya está vinculado a otro celular. Si cambiaste de teléfono, pedile al administrador que lo desvincule desde el panel.`,
      dispositivo_no_vinculado: true,
    });
  }

  const sede = { latitud: usuario.latitud, longitud: usuario.longitud, radio_metros: usuario.radio_metros };
  const { dentro, distancia } = estaDentroDeSede(parseFloat(lat), parseFloat(lng), sede);

  if (!dentro) {
    return res.status(403).json({
      error: `Estás fuera del radio permitido de "${usuario.sede_nombre}". Distancia: ${distancia} m (máximo ${sede.radio_metros} m). Acercate al campus e intentá de nuevo.`,
      distancia,
      radio_permitido: sede.radio_metros,
    });
  }

  const fecha = hoyISO();
  const ahora = new Date().toISOString();

  const abierta = db.prepare(`
    SELECT * FROM asistencias WHERE usuario_id = ? AND fecha = ? AND estado = 'abierta'
    ORDER BY id DESC LIMIT 1
  `).get(usuario.id, fecha);

  const nombreCompleto = `${usuario.nombre} ${usuario.apellido}`;

  if (!abierta) {
    const result = db.prepare(`
      INSERT INTO asistencias
        (usuario_id, sede_id, fecha, ingreso_ts, ingreso_lat, ingreso_lng, ingreso_precision, ingreso_distancia_m, ingreso_foto, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'abierta')
    `).run(usuario.id, usuario.sede_id_real, fecha, ahora, lat, lng, precision || null, distancia, foto_base64);

    return res.json({
      tipo: 'ingreso',
      nombre: nombreCompleto,
      rol: usuario.rol,
      hora: ahora,
      registro_id: result.lastInsertRowid,
      distancia_m: distancia,
    });
  } else {
    const minutos = (new Date(ahora) - new Date(abierta.ingreso_ts)) / 60000;

    db.prepare(`
      UPDATE asistencias
      SET salida_ts = ?, salida_lat = ?, salida_lng = ?, salida_precision = ?,
          salida_distancia_m = ?, salida_foto = ?, minutos_trabajados = ?, estado = 'cerrada'
      WHERE id = ?
    `).run(ahora, lat, lng, precision || null, distancia, foto_base64, Math.round(minutos * 100) / 100, abierta.id);

    return res.json({
      tipo: 'salida',
      nombre: nombreCompleto,
      rol: usuario.rol,
      hora: ahora,
      registro_id: abierta.id,
      minutos_trabajados: Math.round(minutos * 100) / 100,
      distancia_m: distancia,
    });
  }
});

// GET /api/asistencia/historial/:usuarioId?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get('/historial/:usuarioId', (req, res) => {
  const { usuarioId } = req.params;
  const { desde, hasta } = req.query;

  let query = `SELECT * FROM asistencias WHERE usuario_id = ?`;
  const params = [usuarioId];

  if (desde) { query += ` AND fecha >= ?`; params.push(desde); }
  if (hasta) { query += ` AND fecha <= ?`; params.push(hasta); }
  query += ` ORDER BY fecha DESC, id DESC`;

  const registros = db.prepare(query).all(...params);
  res.json({ registros });
});

// GET /api/asistencia/todos?fecha=YYYY-MM-DD&rol=docente  -> vista admin del día
router.get('/todos', (req, res) => {
  const { fecha, rol } = req.query;
  const dia = fecha || hoyISO();

  let query = `
    SELECT a.*, u.legajo, u.nombre, u.apellido, u.rol, s.nombre AS sede_nombre
    FROM asistencias a
    JOIN usuarios u ON u.id = a.usuario_id
    JOIN sedes s ON s.id = a.sede_id
    WHERE a.fecha = ?
  `;
  const params = [dia];

  if (rol) { query += ` AND u.rol = ?`; params.push(rol); }
  query += ` ORDER BY u.rol, u.apellido`;

  const registros = db.prepare(query).all(...params);
  res.json({ registros });
});

module.exports = router;
