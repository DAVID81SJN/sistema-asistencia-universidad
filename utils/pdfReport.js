const PDFDocument = require('pdfkit');
const { calcularPuntualidad } = require('./puntualidad');

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-PE', { hour12: false });
}

/**
 * Escribe un PDF de reporte detallado de asistencia de una persona directamente al stream `res`.
 * Incluye puntualidad (con tolerancia configurable), espacio de firma por día,
 * y una página final de resumen mensual firmable.
 */
function generarReportePDFPersona(usuario, registros, res, config = {}) {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  doc.pipe(res);

  const institucion = config.nombre_institucion || 'Universidad';
  const sedeConfig = config.nombre_sede || '';

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#48536A')
    .text(institucion.toUpperCase() + (sedeConfig ? ' — ' + sedeConfig : ''), { align: 'center' });
  doc.moveDown(0.2);
  doc.fillColor('black').fontSize(18).font('Helvetica-Bold').text('REPORTE DETALLADO DE ASISTENCIA', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).font('Helvetica').text(
    `${usuario.nombre} ${usuario.apellido}   |   Documento: ${usuario.legajo}   |   Rol: ${usuario.rol}   |   Sede: ${usuario.sede_nombre}`,
    { align: 'center' }
  );
  doc.moveDown(0.2);
  doc.fontSize(9).fillColor('gray').text(`Generado el ${new Date().toLocaleString('es-PE')}`, { align: 'center' });
  doc.fillColor('black');
  doc.moveDown(1);

  const startX = 40;
  let y = doc.y;
  const colWidths = [58, 85, 62, 85, 68, 55, 100, 100, 90];
  const headers = ['Fecha', 'H. Ingreso', 'Puntual.', 'H. Salida', 'Pt. Salida', 'Horas', 'Estado', 'Observación', 'Firma'];

  function drawRow(cells, opts = {}) {
    let x = startX;
    const rowHeight = 22;
    if (opts.header) {
      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#2F5496');
      doc.fillColor('white').font('Helvetica-Bold').fontSize(8.5);
    } else {
      if (opts.highlight) {
        doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#FFF2CC');
      }
      doc.fillColor('black').font('Helvetica').fontSize(8);
    }
    cells.forEach((cell, i) => {
      doc.text(String(cell), x + 3, y + 6, { width: colWidths[i] - 6, align: 'left' });
      x += colWidths[i];
    });
    if (!opts.header) {
      // línea para firmar en la última columna
      const firmaX = startX + colWidths.slice(0, -1).reduce((a, b) => a + b, 0);
      doc.moveTo(firmaX + 5, y + rowHeight - 3).lineTo(firmaX + colWidths[colWidths.length - 1] - 5, y + rowHeight - 3)
        .strokeColor('#999').lineWidth(0.5).stroke();
    }
    y += rowHeight;
    if (y > doc.page.height - 60) {
      doc.addPage({ layout: 'landscape' });
      y = 40;
    }
  }

  drawRow(headers, { header: true });

  let totalMinutos = 0;
  let completos = 0;
  let incompletos = 0;
  let puntuales = 0;
  let tarde = 0;

  registros.forEach((r) => {
    const horas = r.minutos_trabajados ? (r.minutos_trabajados / 60).toFixed(2) : '—';
    if (r.minutos_trabajados) totalMinutos += r.minutos_trabajados;
    if (r.estado === 'cerrada') completos++; else incompletos++;

    const { puntualidadIngreso, puntualidadSalida } = calcularPuntualidad(r.ingreso_ts, r.salida_ts, config);
    if (puntualidadIngreso === 'Puntual') puntuales++;
    if (puntualidadIngreso === 'Tarde') tarde++;

    drawRow([
      r.fecha,
      fmt(r.ingreso_ts),
      puntualidadIngreso,
      r.salida_ts ? fmt(r.salida_ts) : (r.estado === 'abierta' ? 'SIN MARCAR' : '—'),
      puntualidadSalida,
      horas,
      r.estado === 'cerrada' ? 'Completo' : 'Incompleto',
      r.observacion || '',
      '',
    ], { highlight: r.estado === 'abierta' });
  });

  y += 10;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('black');
  doc.text(
    `TOTAL: ${(totalMinutos / 60).toFixed(2)} horas  |  ${completos} completos / ${incompletos} incompletos  |  ${puntuales} puntual(es) / ${tarde} tarde(s)`,
    startX, y
  );

  // ---------- Página de resumen mensual firmable ----------
  doc.addPage({ layout: 'landscape' });
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#48536A')
    .text(institucion.toUpperCase() + (sedeConfig ? ' — ' + sedeConfig : ''), { align: 'center' });
  doc.moveDown(0.3);
  doc.fillColor('black').fontSize(20).font('Helvetica-Bold').text('RESUMEN MENSUAL DE ASISTENCIA', { align: 'center' });
  doc.moveDown(1.5);

  doc.fontSize(12).font('Helvetica');
  const infoX = 100;
  let infoY = doc.y;
  const filas = [
    ['Nombre completo', `${usuario.nombre} ${usuario.apellido}`],
    ['Documento', usuario.legajo],
    ['Rol', usuario.rol],
    ['Sede', usuario.sede_nombre],
    ['Total de horas trabajadas', `${(totalMinutos / 60).toFixed(2)} hs`],
    ['Días completos', completos],
    ['Días incompletos', incompletos],
    ['Días puntuales', puntuales],
    ['Días con llegada tarde', tarde],
  ];
  filas.forEach(([label, valor]) => {
    doc.font('Helvetica-Bold').text(`${label}:`, infoX, infoY, { continued: true, width: 250 });
    doc.font('Helvetica').text(`  ${valor}`);
    infoY += 24;
  });

  infoY += 60;
  doc.moveTo(infoX, infoY).lineTo(infoX + 220, infoY).strokeColor('#000').lineWidth(1).stroke();
  doc.moveTo(infoX + 320, infoY).lineTo(infoX + 540, infoY).stroke();
  doc.fontSize(10).font('Helvetica')
    .text('Firma del empleado/alumno', infoX, infoY + 8, { width: 220, align: 'center' })
    .text('Firma del administrador', infoX + 320, infoY + 8, { width: 220, align: 'center' });

  doc.end();
}

module.exports = { generarReportePDFPersona };
