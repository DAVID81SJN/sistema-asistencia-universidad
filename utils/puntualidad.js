/**
 * Determina si un ingreso/salida está dentro de la tolerancia configurada,
 * para no computarlo como tarde/ausente si se marcó dentro del margen.
 */
function calcularPuntualidad(ingreso_ts, salida_ts, config) {
  const tolerancia = parseInt(config.tolerancia_minutos || '10', 10);
  const horaEntradaEsperada = config.hora_entrada_esperada || '08:00';
  const horaSalidaEsperada = config.hora_salida_esperada || '17:00';

  let puntualidadIngreso = '—';
  if (ingreso_ts) {
    const fecha = ingreso_ts.slice(0, 10);
    const limite = new Date(`${fecha}T${horaEntradaEsperada}:00`);
    limite.setMinutes(limite.getMinutes() + tolerancia);
    puntualidadIngreso = new Date(ingreso_ts) <= limite ? 'Puntual' : 'Tarde';
  }

  let puntualidadSalida = '—';
  if (salida_ts) {
    const fecha = salida_ts.slice(0, 10);
    const limite = new Date(`${fecha}T${horaSalidaEsperada}:00`);
    limite.setMinutes(limite.getMinutes() - tolerancia);
    puntualidadSalida = new Date(salida_ts) >= limite ? 'A horario' : 'Salida anticipada';
  }

  return { puntualidadIngreso, puntualidadSalida };
}

module.exports = { calcularPuntualidad };
