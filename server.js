const express = require('express');
const cors = require('cors');
const path = require('path');

require('./db/seed'); // crea tablas y datos demo la primera vez que arranca (es seguro re-ejecutarlo)

const authRoutes = require('./routes/auth');
const asistenciaRoutes = require('./routes/asistencia');
const adminRoutes = require('./routes/admin');
const reportesRoutes = require('./routes/reportes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/asistencia', asistenciaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reportes', reportesRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, hora: new Date().toISOString() }));

// Frontend estático
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Servidor de asistencia corriendo en http://localhost:${PORT}`);
});
