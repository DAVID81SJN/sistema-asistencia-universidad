const db = require('./database');

function seed() {
  const sedeCount = db.prepare('SELECT COUNT(*) AS c FROM sedes').get().c;

  if (sedeCount === 0) {
    const insertSede = db.prepare(`
      INSERT INTO sedes (nombre, latitud, longitud, radio_metros)
      VALUES (?, ?, ?, ?)
    `);
    // Coordenadas de ejemplo (ajustar a la ubicación real del campus)
    const campusPrincipal = insertSede.run('Campus Principal', -12.046374, -77.042793, 200);
    const sedeAnexo = insertSede.run('Sede Anexo Ingeniería', -12.050000, -77.036000, 150);

    console.log('Sedes creadas:', campusPrincipal.lastInsertRowid, sedeAnexo.lastInsertRowid);

    const insertUsuario = db.prepare(`
      INSERT INTO usuarios (legajo, nombre, apellido, rol, email, pin, sede_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const usuarios = [
      // Administrativos
      ['ADM-001', 'Maria', 'Gonzalez', 'administrativo', 'mgonzalez@universidad.edu', '1111', campusPrincipal.lastInsertRowid],
      ['ADM-002', 'Carlos', 'Ramirez', 'administrativo', 'cramirez@universidad.edu', '1111', campusPrincipal.lastInsertRowid],
      // Docentes
      ['DOC-001', 'Ana', 'Torres', 'docente', 'atorres@universidad.edu', '2222', campusPrincipal.lastInsertRowid],
      ['DOC-002', 'Luis', 'Fernandez', 'docente', 'lfernandez@universidad.edu', '2222', sedeAnexo.lastInsertRowid],
      // Alumnos
      ['ALU-001', 'Pedro', 'Lopez', 'alumno', 'plopez@alumno.universidad.edu', '3333', campusPrincipal.lastInsertRowid],
      ['ALU-002', 'Lucia', 'Martinez', 'alumno', 'lmartinez@alumno.universidad.edu', '3333', campusPrincipal.lastInsertRowid],
      ['ALU-003', 'Jorge', 'Diaz', 'alumno', 'jdiaz@alumno.universidad.edu', '3333', sedeAnexo.lastInsertRowid],
    ];

    const insertMany = db.transaction((rows) => {
      for (const r of rows) insertUsuario.run(...r);
    });
    insertMany(usuarios);

    console.log(`${usuarios.length} usuarios de ejemplo creados.`);
  } else {
    console.log('La base de datos ya tiene datos. Seed omitido.');
  }
}

seed();
