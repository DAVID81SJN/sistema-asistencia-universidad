const ExcelJS = require('exceljs');
const { calcularPuntualidad } = require('./puntualidad');

function fmt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('es-PE', { hour12: false });
}

/**
 * Genera un workbook de Excel con el reporte detallado de asistencia de una persona.
 * Incluye puntualidad (con tolerancia), columna de firma diaria y una hoja de
 * resumen mensual con espacio de firma, lista para imprimir.
 */
async function generarReporteExcelPersona(usuario, registros, config = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Asistencia Universitaria';
  wb.created = new Date();

  const institucion = config.nombre_institucion || 'Universidad';
  const sedeConfig = config.nombre_sede || '';

  // ---------- HOJA 1: Detalle diario ----------
  const ws = wb.addWorksheet('Detalle Diario');

  ws.mergeCells('A1', 'K1');
  ws.getCell('A1').value = institucion.toUpperCase() + (sedeConfig ? ' — ' + sedeConfig : '');
  ws.getCell('A1').font = { size: 13, bold: true };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.mergeCells('A2', 'K2');
  ws.getCell('A2').value = 'REPORTE DETALLADO DE ASISTENCIA';
  ws.getCell('A2').font = { size: 15, bold: true };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  ws.mergeCells('A3', 'K3');
  ws.getCell('A3').value = `${usuario.nombre} ${usuario.apellido}  |  Documento: ${usuario.legajo}  |  Rol: ${usuario.rol}  |  Sede: ${usuario.sede_nombre}`;
  ws.getCell('A3').font = { size: 11, italic: true };
  ws.getCell('A3').alignment = { horizontal: 'center' };

  ws.addRow([]);

  const headerRow = ws.addRow([
    'Fecha', 'Hora Ingreso', 'Puntualidad', 'Hora Salida', 'Puntualidad Salida',
    'Horas Trabajadas', 'Estado', 'Observación', 'Firma del día'
  ]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } };
    cell.alignment = { horizontal: 'center' };
  });

  let totalMinutos = 0;
  let diasCompletos = 0;
  let diasIncompletos = 0;
  let diasPuntuales = 0;
  let diasTarde = 0;

  registros.forEach((r) => {
    const horas = r.minutos_trabajados ? (r.minutos_trabajados / 60) : null;
    if (r.minutos_trabajados) totalMinutos += r.minutos_trabajados;
    if (r.estado === 'cerrada') diasCompletos++; else diasIncompletos++;

    const { puntualidadIngreso, puntualidadSalida } = calcularPuntualidad(r.ingreso_ts, r.salida_ts, config);
    if (puntualidadIngreso === 'Puntual') diasPuntuales++;
    if (puntualidadIngreso === 'Tarde') diasTarde++;

    const row = ws.addRow([
      r.fecha,
      r.ingreso_ts ? fmt(r.ingreso_ts) : '—',
      puntualidadIngreso,
      r.salida_ts ? fmt(r.salida_ts) : (r.estado === 'abierta' ? 'SIN MARCAR' : '—'),
      puntualidadSalida,
      horas !== null ? horas.toFixed(2) : '—',
      r.estado === 'cerrada' ? 'Completo' : 'Incompleto (falta salida)',
      r.observacion || '',
      '', // espacio en blanco para firmar (impreso)
    ]);

    if (r.estado === 'abierta') {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      });
    }
    row.getCell(9).border = { bottom: { style: 'thin' } };
  });

  ws.addRow([]);
  const totalRow = ws.addRow([
    'TOTALES', '', '', '', '',
    (totalMinutos / 60).toFixed(2) + ' hs',
    `${diasCompletos} completos / ${diasIncompletos} incompletos`,
    `${diasPuntuales} puntual(es) / ${diasTarde} tarde(s)`,
  ]);
  totalRow.font = { bold: true };

  ws.columns.forEach((col) => { col.width = 17; });
  ws.getColumn(1).width = 12;
  ws.getColumn(8).width = 22;
  ws.getColumn(9).width = 22;

  // ---------- HOJA 2: Resumen mensual firmable ----------
  const ws2 = wb.addWorksheet('Resumen Mensual');
  ws2.mergeCells('A1', 'D1');
  ws2.getCell('A1').value = institucion.toUpperCase() + (sedeConfig ? ' — ' + sedeConfig : '');
  ws2.getCell('A1').font = { size: 13, bold: true };

  ws2.mergeCells('A2', 'D2');
  ws2.getCell('A2').value = 'RESUMEN MENSUAL DE ASISTENCIA';
  ws2.getCell('A2').font = { size: 15, bold: true };

  ws2.addRow([]);
  ws2.addRow(['Nombre completo', `${usuario.nombre} ${usuario.apellido}`]);
  ws2.addRow(['Documento', usuario.legajo]);
  ws2.addRow(['Rol', usuario.rol]);
  ws2.addRow(['Sede', usuario.sede_nombre]);
  ws2.addRow([]);
  ws2.addRow(['Total de horas trabajadas', (totalMinutos / 60).toFixed(2) + ' hs']);
  ws2.addRow(['Días completos', diasCompletos]);
  ws2.addRow(['Días incompletos (sin salida marcada)', diasIncompletos]);
  ws2.addRow(['Días puntuales', diasPuntuales]);
  ws2.addRow(['Días con llegada tarde', diasTarde]);
  ws2.addRow([]);
  ws2.addRow([]);
  ws2.addRow(['', '']);
  const firmaRow = ws2.addRow(['_____________________________', '_____________________________']);
  firmaRow.font = { bold: false };
  ws2.addRow(['Firma del empleado/alumno', 'Firma del administrador']);
  ws2.columns.forEach((col) => { col.width = 32; });

  return wb;
}

/**
 * Genera un reporte Excel consolidado (todas las personas) para un rango de fechas.
 */
async function generarReporteExcelGeneral(filas, filtroInfo = '', config = {}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Asistencia General');

  const institucion = config.nombre_institucion || 'Universidad';
  const sedeConfig = config.nombre_sede || '';

  ws.mergeCells('A1', 'K1');
  ws.getCell('A1').value = institucion.toUpperCase() + (sedeConfig ? ' — ' + sedeConfig : '');
  ws.getCell('A1').font = { size: 13, bold: true };
  ws.getCell('A1').alignment = { horizontal: 'center' };

  ws.mergeCells('A2', 'K2');
  ws.getCell('A2').value = 'REPORTE GENERAL DE ASISTENCIA';
  ws.getCell('A2').font = { size: 15, bold: true };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  if (filtroInfo) {
    ws.mergeCells('A3', 'K3');
    ws.getCell('A3').value = filtroInfo;
    ws.getCell('A3').font = { italic: true };
    ws.getCell('A3').alignment = { horizontal: 'center' };
  }

  ws.addRow([]);
  const headerRow = ws.addRow([
    'Documento', 'Nombre', 'Apellido', 'Rol', 'Sede', 'Fecha',
    'Hora Ingreso', 'Puntualidad', 'Hora Salida', 'Horas Trabajadas', 'Estado', 'Firma'
  ]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } };
  });

  filas.forEach((r) => {
    const horas = r.minutos_trabajados ? (r.minutos_trabajados / 60).toFixed(2) : '—';
    const { puntualidadIngreso } = calcularPuntualidad(r.ingreso_ts, r.salida_ts, config);
    ws.addRow([
      r.legajo, r.nombre, r.apellido, r.rol, r.sede_nombre, r.fecha,
      r.ingreso_ts ? fmt(r.ingreso_ts) : '—',
      puntualidadIngreso,
      r.salida_ts ? fmt(r.salida_ts) : (r.estado === 'abierta' ? 'SIN MARCAR' : '—'),
      horas,
      r.estado === 'cerrada' ? 'Completo' : 'Incompleto',
      '',
    ]);
  });

  ws.columns.forEach((col) => { col.width = 16; });
  return wb;
}

module.exports = { generarReporteExcelPersona, generarReporteExcelGeneral };
