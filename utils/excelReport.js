const ExcelJS = require('exceljs');

function fmt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('es-PE', { hour12: false });
}

/**
 * Genera un workbook de Excel con el reporte detallado de asistencia de una persona.
 * usuario: {legajo, nombre, apellido, rol, sede_nombre}
 * registros: array de filas de la tabla asistencias
 * Devuelve un ExcelJS.Workbook listo para escribir a un stream/buffer.
 */
async function generarReporteExcelPersona(usuario, registros) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Asistencia Universitaria';
  wb.created = new Date();

  const ws = wb.addWorksheet('Reporte de Asistencia');

  ws.mergeCells('A1', 'J1');
  ws.getCell('A1').value = 'REPORTE DETALLADO DE ASISTENCIA';
  ws.getCell('A1').font = { size: 16, bold: true };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.mergeCells('A2', 'J2');
  ws.getCell('A2').value = `${usuario.nombre} ${usuario.apellido}  |  Legajo: ${usuario.legajo}  |  Rol: ${usuario.rol}  |  Sede: ${usuario.sede_nombre}`;
  ws.getCell('A2').font = { size: 11, italic: true };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  ws.addRow([]);

  const headerRow = ws.addRow([
    'Fecha', 'Hora Ingreso', 'Distancia Ingreso (m)',
    'Hora Salida', 'Distancia Salida (m)',
    'Horas Trabajadas', 'Estado', 'Lat Ingreso', 'Lng Ingreso', 'Observación'
  ]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } };
    cell.alignment = { horizontal: 'center' };
  });

  let totalMinutos = 0;
  let diasCompletos = 0;
  let diasIncompletos = 0;

  registros.forEach((r) => {
    const horas = r.minutos_trabajados ? (r.minutos_trabajados / 60) : null;
    if (r.minutos_trabajados) totalMinutos += r.minutos_trabajados;
    if (r.estado === 'cerrada') diasCompletos++; else diasIncompletos++;

    const row = ws.addRow([
      r.fecha,
      r.ingreso_ts ? fmt(r.ingreso_ts) : '—',
      r.ingreso_distancia_m ?? '—',
      r.salida_ts ? fmt(r.salida_ts) : (r.estado === 'abierta' ? 'SIN MARCAR' : '—'),
      r.salida_distancia_m ?? '—',
      horas !== null ? horas.toFixed(2) : '—',
      r.estado === 'cerrada' ? 'Completo' : 'Incompleto (falta salida)',
      r.ingreso_lat ?? '',
      r.ingreso_lng ?? '',
      r.observacion || '',
    ]);

    if (r.estado === 'abierta') {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      });
    }
  });

  ws.addRow([]);
  const totalRow = ws.addRow(['TOTALES', '', '', '', '', (totalMinutos / 60).toFixed(2) + ' hs', `${diasCompletos} completos / ${diasIncompletos} incompletos`]);
  totalRow.font = { bold: true };

  ws.columns.forEach((col) => { col.width = 20; });
  ws.getColumn(1).width = 14;
  ws.getColumn(10).width = 25;

  return wb;
}

/**
 * Genera un reporte Excel consolidado (todas las personas) para un rango de fechas.
 * filas: array de {legajo, nombre, apellido, rol, fecha, ingreso_ts, salida_ts, minutos_trabajados, estado, sede_nombre}
 */
async function generarReporteExcelGeneral(filas, filtroInfo = '') {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Asistencia General');

  ws.mergeCells('A1', 'I1');
  ws.getCell('A1').value = 'REPORTE GENERAL DE ASISTENCIA - UNIVERSIDAD';
  ws.getCell('A1').font = { size: 16, bold: true };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  if (filtroInfo) {
    ws.mergeCells('A2', 'I2');
    ws.getCell('A2').value = filtroInfo;
    ws.getCell('A2').font = { italic: true };
    ws.getCell('A2').alignment = { horizontal: 'center' };
  }

  ws.addRow([]);
  const headerRow = ws.addRow([
    'Legajo', 'Nombre', 'Apellido', 'Rol', 'Sede', 'Fecha',
    'Hora Ingreso', 'Hora Salida', 'Horas Trabajadas', 'Estado'
  ]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } };
  });

  filas.forEach((r) => {
    const horas = r.minutos_trabajados ? (r.minutos_trabajados / 60).toFixed(2) : '—';
    ws.addRow([
      r.legajo, r.nombre, r.apellido, r.rol, r.sede_nombre, r.fecha,
      r.ingreso_ts ? fmt(r.ingreso_ts) : '—',
      r.salida_ts ? fmt(r.salida_ts) : (r.estado === 'abierta' ? 'SIN MARCAR' : '—'),
      horas,
      r.estado === 'cerrada' ? 'Completo' : 'Incompleto',
    ]);
  });

  ws.columns.forEach((col) => { col.width = 18; });
  return wb;
}

module.exports = { generarReporteExcelPersona, generarReporteExcelGeneral };
