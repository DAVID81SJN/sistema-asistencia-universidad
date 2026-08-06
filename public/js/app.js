const API = '/api';
let ultimaPosicion = null;
let fotoBase64 = null;

// Identificador único de este dispositivo/navegador. Se genera una sola vez y
// se guarda en el celular; sirve para que el sistema detecte si alguien intenta
// marcar el mismo usuario desde un teléfono distinto.
function obtenerDeviceToken() {
  let token = localStorage.getItem('device_token');
  if (!token) {
    token = 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
    localStorage.setItem('device_token', token);
  }
  return token;
}

// ---------- Foto de verificación ----------
// Se toma con la cámara del celular (sin instalar nada) y se comprime en el
// propio navegador antes de enviarla, para no cargar la base de datos.
function onFotoSeleccionada(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const MAX = 320; // ancho/alto máximo, alcanza para identificar a la persona
      let w = img.width, h = img.height;
      if (w > h && w > MAX) { h = h * (MAX / w); w = MAX; }
      else if (h > MAX) { w = w * (MAX / h); h = MAX; }

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      fotoBase64 = canvas.toDataURL('image/jpeg', 0.6);

      document.getElementById('foto-preview-img').src = fotoBase64;
      document.getElementById('foto-preview-img').style.display = 'inline-block';
      document.getElementById('foto-preview-texto').textContent = '✓ Foto lista. Tocá para volver a tomarla.';
      actualizarBoton();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function iniciarGPS() {
  if (!navigator.geolocation) {
    setGPSEstado('fuera', '⚠', 'Este dispositivo no soporta geolocalización.');
    return;
  }
  navigator.geolocation.watchPosition(onPosicion, onErrorGPS, {
    enableHighAccuracy: true, maximumAge: 5000, timeout: 15000
  });
}

function setGPSEstado(clase, dist, label) {
  const ring = document.getElementById('gps-ring');
  ring.className = 'gps-ring ' + clase;
  document.getElementById('gps-dist').textContent = dist;
  document.getElementById('gps-label').textContent = label;
}

function actualizarBoton() {
  const btn = document.getElementById('btn-marcar');
  if (ultimaPosicion && fotoBase64) {
    btn.disabled = false;
    btn.textContent = 'Marcar asistencia';
  } else if (!ultimaPosicion) {
    btn.disabled = true;
    btn.textContent = 'Verificando ubicación…';
  } else {
    btn.disabled = true;
    btn.textContent = 'Falta la foto de verificación';
  }
}

function onErrorGPS() {
  setGPSEstado('fuera', '⚠', 'No se pudo obtener tu ubicación. Activá el GPS y recargá la página.');
  ultimaPosicion = null;
  actualizarBoton();
}

function onPosicion(pos) {
  ultimaPosicion = pos.coords;
  setGPSEstado('dentro', `± ${Math.round(pos.coords.accuracy)} m`, 'Ubicación obtenida. Verificaremos tu campus al marcar.');
  actualizarBoton();
}

async function marcar() {
  const errBox = document.getElementById('marcar-error');
  errBox.innerHTML = '';

  const legajo = document.getElementById('legajo').value.trim();
  const pin = document.getElementById('pin').value.trim();

  if (!legajo || !pin) {
    errBox.innerHTML = '<div class="error-msg">Completá usuario y contraseña.</div>';
    return;
  }
  if (!ultimaPosicion) {
    errBox.innerHTML = '<div class="error-msg">Todavía no tenemos tu ubicación GPS. Esperá unos segundos.</div>';
    return;
  }
  if (!fotoBase64) {
    errBox.innerHTML = '<div class="error-msg">Tomate la foto de verificación antes de marcar.</div>';
    return;
  }

  const btn = document.getElementById('btn-marcar');
  btn.disabled = true;
  btn.textContent = 'Registrando…';

  try {
    const r = await fetch(`${API}/asistencia/marcar-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        legajo, password: pin,
        lat: ultimaPosicion.latitude,
        lng: ultimaPosicion.longitude,
        precision: ultimaPosicion.accuracy,
        device_token: obtenerDeviceToken(),
        foto_base64: fotoBase64
      })
    });
    const data = await r.json();

    if (!r.ok) {
      errBox.innerHTML = `<div class="error-msg">${data.error}</div>`;
      btn.disabled = false;
      btn.textContent = 'Marcar asistencia';
      return;
    }

    mostrarSello(data.tipo, new Date(data.hora), data.nombre);
    document.getElementById('ultimo-registro').textContent =
      `${data.tipo === 'ingreso' ? 'Ingreso' : 'Salida'} registrado para ${data.nombre} a las ${new Date(data.hora).toLocaleTimeString('es-PE')}. Listo para la siguiente persona.`;

    // Limpiar el formulario para que la siguiente persona pueda loguearse
    document.getElementById('legajo').value = '';
    document.getElementById('pin').value = '';
    fotoBase64 = null;
    document.getElementById('foto-preview-img').style.display = 'none';
    document.getElementById('foto-preview-img').src = '';
    document.getElementById('foto-preview-texto').textContent = '📷 Tocá acá para tomarte una foto';
    document.getElementById('foto-input').value = '';
    btn.disabled = false;
    btn.textContent = 'Marcar asistencia';
    actualizarBoton();
  } catch (e) {
    errBox.innerHTML = '<div class="error-msg">Error de conexión con el servidor.</div>';
    btn.disabled = false;
    btn.textContent = 'Marcar asistencia';
  }
}

function mostrarSello(tipo, fecha, nombre) {
  document.getElementById('stamp-tipo').textContent = tipo === 'ingreso' ? 'Ingreso registrado' : 'Salida registrada';
  document.getElementById('stamp-hora').textContent = fecha.toLocaleTimeString('es-PE');
  document.getElementById('stamp-nombre').textContent = nombre;
  const overlay = document.getElementById('stamp-overlay');
  overlay.classList.add('show');
  setTimeout(() => overlay.classList.remove('show'), 2200);
}

iniciarGPS();
