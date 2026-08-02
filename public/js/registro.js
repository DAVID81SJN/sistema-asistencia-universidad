const API = '/api';

async function registrar() {
  const errBox = document.getElementById('registro-error');
  errBox.innerHTML = '';

  const nombre_completo = document.getElementById('nombre').value.trim();
  const documento = document.getElementById('documento').value.trim();
  const rol = document.getElementById('rol').value;
  const pin = document.getElementById('pin').value.trim();
  const pin_confirm = document.getElementById('pin2').value.trim();

  if (!nombre_completo || !documento || !rol || !pin || !pin_confirm) {
    errBox.innerHTML = '<div class="error-msg">Completá todos los campos.</div>';
    return;
  }
  if (!/^\d{4}$/.test(pin)) {
    errBox.innerHTML = '<div class="error-msg">La contraseña debe ser de exactamente 4 dígitos.</div>';
    return;
  }
  if (pin !== pin_confirm) {
    errBox.innerHTML = '<div class="error-msg">Las contraseñas no coinciden.</div>';
    return;
  }

  try {
    const r = await fetch(`${API}/auth/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre_completo, documento, rol, pin, pin_confirm })
    });
    const data = await r.json();

    if (!r.ok) {
      errBox.innerHTML = `<div class="error-msg">${data.error}</div>`;
      return;
    }

    document.getElementById('form-view').style.display = 'none';
    document.getElementById('ok-view').style.display = 'block';
    document.getElementById('ok-mensaje').textContent =
      `Listo, ${nombre_completo}. Tu usuario es tu documento (${documento}). Guardá bien tu contraseña.`;
  } catch (e) {
    errBox.innerHTML = '<div class="error-msg">Error de conexión con el servidor.</div>';
  }
}
