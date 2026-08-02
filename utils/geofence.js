/**
 * Calcula la distancia en metros entre dos coordenadas GPS
 * usando la fórmula de Haversine.
 */
function distanciaMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000; // radio de la tierra en metros
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Determina si un punto GPS está dentro del radio permitido de una sede.
 * Devuelve { dentro: boolean, distancia: number }
 */
function estaDentroDeSede(lat, lng, sede) {
  const distancia = distanciaMetros(lat, lng, sede.latitud, sede.longitud);
  return {
    dentro: distancia <= sede.radio_metros,
    distancia: Math.round(distancia * 100) / 100,
  };
}

module.exports = { distanciaMetros, estaDentroDeSede };
