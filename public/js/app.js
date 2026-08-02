const API = '/api';
let ultimaPosicion = null;

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
  if (ultimaPosicion) {
    btn.disabled = false;
    btn.textContent = 'Marcar asistencia';
  } else {
    btn.disabled = true;
    btn.textContent = 'Verificando ubicación…';
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
        precision: ultimaPosicion.accuracy
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
    btn.disabled = false;
    btn.textContent = 'Marcar asistencia';
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
