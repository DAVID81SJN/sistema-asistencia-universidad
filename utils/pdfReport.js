const PDFDocument = require('pdfkit');

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-PE', { hour12: false });
}

/**
 * Escribe un PDF de reporte detallado de asistencia de una persona directamente al stream `res`.
 */
function generarReportePDFPersona(usuario, registros, res) {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').text('REPORTE DETALLADO DE ASISTENCIA', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).font('Helvetica').text(
    `${usuario.nombre} ${usuario.apellido}   |   Legajo: ${usuario.legajo}   |   Rol: ${usuario.rol}   |   Sede: ${usuario.sede_nombre}`,
    { align: 'center' }
  );
  doc.moveDown(0.2);
  doc.fontSize(9).fillColor('gray').text(`Generado el ${new Date().toLocaleString('es-PE')}`, { align: 'center' });
  doc.fillColor('black');
  doc.moveDown(1);

  const startX = 40;
  let y = doc.y;
  const colWidths = [65, 100, 70, 100, 70, 70, 110, 100];
  const headers = ['Fecha', 'Hora Ingreso', 'Dist. Ing (m)', 'Hora Salida', 'Dist. Sal (m)', 'Horas', 'Estado', 'Observación'];

  function drawRow(cells, opts = {}) {
    let x = startX;
    const rowHeight = 20;
    if (opts.header) {
      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#2F5496');
      doc.fillColor('white').font('Helvetica-Bold').fontSize(9);
    } else {
      if (opts.highlight) {
        doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#FFF2CC');
      }
      doc.fillColor('black').font('Helvetica').fontSize(8.5);
    }
    cells.forEach((cell, i) => {
      doc.text(String(cell), x + 3, y + 5, { width: colWidths[i] - 6, align: 'left' });
      x += colWidths[i];
    });
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

  registros.forEach((r) => {
    const horas = r.minutos_trabajados ? (r.minutos_trabajados / 60).toFixed(2) : '—';
    if (r.minutos_trabajados) totalMinutos += r.minutos_trabajados;
    if (r.estado === 'cerrada') completos++; else incompletos++;

    drawRow([
      r.fecha,
      fmt(r.ingreso_ts),
      r.ingreso_distancia_m ?? '—',
      r.salida_ts ? fmt(r.salida_ts) : (r.estado === 'abierta' ? 'SIN MARCAR' : '—'),
      r.salida_distancia_m ?? '—',
      horas,
      r.estado === 'cerrada' ? 'Completo' : 'Incompleto',
      r.observacion || '',
    ], { highlight: r.estado === 'abierta' });
  });

  y += 10;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('black');
  doc.text(
    `TOTAL: ${(totalMinutos / 60).toFixed(2)} horas trabajadas  |  ${completos} días completos  |  ${incompletos} días incompletos`,
    startX, y
  );

  doc.end();
}

module.exports = { generarReportePDFPersona };
