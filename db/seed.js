const db = require('./database');

// Este seed SOLO crea la sede (ubicación del campus) la primera vez que arranca
// el sistema desde cero. Ya NO crea usuarios de ejemplo: los administrativos,
// docentes y alumnos se dan de alta ellos mismos desde /registro.html.
function seed() {
  const sedeCount = db.prepare('SELECT COUNT(*) AS c FROM sedes').get().c;

  if (sedeCount === 0) {
    const insertSede = db.prepare(`
      INSERT INTO sedes (nombre, latitud, longitud, radio_metros)
      VALUES (?, ?, ?, ?)
    `);
    // Coordenadas de ejemplo: reemplazar desde el panel admin -> "Configuración del campus"
    const campusPrincipal = insertSede.run('Campus Principal', -12.046374, -77.042793, 200);
    console.log('Sede inicial creada:', campusPrincipal.lastInsertRowid, '(actualizar coordenadas reales desde el panel admin)');
  } else {
    console.log('La base de datos ya tiene datos. Seed omitido.');
  }
}

seed();
