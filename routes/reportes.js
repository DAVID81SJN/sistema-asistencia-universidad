const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { generarReporteExcelPersona, generarReporteExcelGeneral } = require('../utils/excelReport');
const { generarReportePDFPersona } = require('../utils/pdfReport');

function obtenerUsuario(usuarioId) {
  return db.prepare(`
    SELECT u.*, s.nombre AS sede_nombre FROM usuarios u
    JOIN sedes s ON s.id = u.sede_id WHERE u.id = ?
  `).get(usuarioId);
}

function obtenerRegistros(usuarioId, desde, hasta) {
  let query = `SELECT * FROM asistencias WHERE usuario_id = ?`;
  const params = [usuarioId];
  if (desde) { query += ` AND fecha >= ?`; params.push(desde); }
  if (hasta) { query += ` AND fecha <= ?`; params.push(hasta); }
  query += ` ORDER BY fecha ASC`;
  return db.prepare(query).all(...params);
}

// GET /api/reportes/excel/:usuarioId?desde=&hasta=
router.get('/excel/:usuarioId', async (req, res) => {
  const usuario = obtenerUsuario(req.params.usuarioId);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

  const registros = obtenerRegistros(req.params.usuarioId, req.query.desde, req.query.hasta);
  const wb = await generarReporteExcelPersona(usuario, registros);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="asistencia_${usuario.legajo}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// GET /api/reportes/pdf/:usuarioId?desde=&hasta=
router.get('/pdf/:usuarioId', (req, res) => {
  const usuario = obtenerUsuario(req.params.usuarioId);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

  const registros = obtenerRegistros(req.params.usuarioId, req.query.desde, req.query.hasta);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="asistencia_${usuario.legajo}.pdf"`);
  generarReportePDFPersona(usuario, registros, res);
});

// GET /api/reportes/excel-general?desde=&hasta=&rol=
router.get('/excel-general', async (req, res) => {
  const { desde, hasta, rol } = req.query;

  let query = `
    SELECT u.legajo, u.nombre, u.apellido, u.rol, s.nombre AS sede_nombre,
           a.fecha, a.ingreso_ts, a.salida_ts, a.minutos_trabajados, a.estado
    FROM asistencias a
    JOIN usuarios u ON u.id = a.usuario_id
    JOIN sedes s ON s.id = a.sede_id
    WHERE 1=1
  `;
  const params = [];
  if (desde) { query += ` AND a.fecha >= ?`; params.push(desde); }
  if (hasta) { query += ` AND a.fecha <= ?`; params.push(hasta); }
  if (rol) { query += ` AND u.rol = ?`; params.push(rol); }
  query += ` ORDER BY a.fecha ASC, u.apellido ASC`;

  const filas = db.prepare(query).all(...params);
  const filtroInfo = `Periodo: ${desde || 'inicio'} a ${hasta || 'hoy'}${rol ? ` | Rol: ${rol}` : ''}`;
  const wb = await generarReporteExcelGeneral(filas, filtroInfo);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="asistencia_general.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// GET /api/reportes/resumen?desde=&hasta=&rol=  -> resumen agregado por persona
router.get('/resumen', (req, res) => {
  const { desde, hasta, rol } = req.query;

  let query = `
    SELECT u.id AS usuario_id, u.legajo, u.nombre, u.apellido, u.rol, s.nombre AS sede_nombre,
      COUNT(a.id) AS total_marcaciones,
      SUM(CASE WHEN a.estado = 'cerrada' THEN 1 ELSE 0 END) AS dias_completos,
      SUM(CASE WHEN a.estado = 'abierta' THEN 1 ELSE 0 END) AS dias_incompletos,
      COALESCE(SUM(a.minutos_trabajados), 0) AS total_minutos,
      MAX(a.fecha) AS ultima_fecha
    FROM usuarios u
    JOIN sedes s ON s.id = u.sede_id
    LEFT JOIN asistencias a ON a.usuario_id = u.id
      ${desde ? 'AND a.fecha >= ?' : ''}
      ${hasta ? 'AND a.fecha <= ?' : ''}
    WHERE u.activo = 1
  `;
  const params = [];
  if (desde) params.push(desde);
  if (hasta) params.push(hasta);

  if (rol) { query += ` AND u.rol = ?`; params.push(rol); }
  query += ` GROUP BY u.id ORDER BY u.rol, u.apellido`;

  const filas = db.prepare(query).all(...params).map(f => ({
    ...f,
    total_horas: Math.round((f.total_minutos / 60) * 100) / 100,
  }));

  res.json({ resumen: filas });
});

module.exports = router;
