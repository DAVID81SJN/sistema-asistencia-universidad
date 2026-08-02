const API = '/api';
let usuarios = [];

// ---------- ACCESO CON CÓDIGO ----------
async function ingresarAdmin() {
  const codigo = document.getElementById('admin-codigo').value.trim();
  const errBox = document.getElementById('gate-error');
  errBox.innerHTML = '';

  try {
    const r = await fetch(`${API}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo })
    });
    if (!r.ok) {
      errBox.innerHTML = '<div class="error-msg">Código incorrecto.</div>';
      return;
    }
    mostrarPanel();
  } catch (e) {
    errBox.innerHTML = '<div class="error-msg">Error de conexión con el servidor.</div>';
  }
}

async function mostrarPanel() {
  document.getElementById('gate-view').style.display = 'none';
  document.getElementById('panel-content').style.display = 'block';
  await inicializarPanel();
}

function hoyISO() { return new Date().toISOString().slice(0,10); }

function inicioDeMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

let sedes = [];

async function cargarSedes() {
  const r = await fetch(`${API}/admin/sedes`);
  const data = await r.json();
  sedes = data.sedes;
  const sel = document.getElementById('sede-select');
  sel.innerHTML = sedes.map(s => `<option value="${s.id}">${s.nombre}</option>`).join('');
  cargarSedeEnFormulario();
}

function cargarSedeEnFormulario() {
  const id = parseInt(document.getElementById('sede-select').value);
  const sede = sedes.find(s => s.id === id);
  if (!sede) return;
  document.getElementById('sede-nombre').value = sede.nombre;
  document.getElementById('sede-lat').value = sede.latitud;
  document.getElementById('sede-lng').value = sede.longitud;
  document.getElementById('sede-radio').value = sede.radio_metros;
}

async function guardarSede() {
  const id = document.getElementById('sede-select').value;
  const nombre = document.getElementById('sede-nombre').value.trim();
  const latitud = parseFloat(document.getElementById('sede-lat').value);
  const longitud = parseFloat(document.getElementById('sede-lng').value);
  const radio_metros = parseFloat(document.getElementById('sede-radio').value);

  if (isNaN(latitud) || isNaN(longitud) || isNaN(radio_metros)) {
    alert('Revisá que latitud, longitud y radio sean números válidos.');
    return;
  }

  const r = await fetch(`${API}/admin/sedes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, latitud, longitud, radio_metros })
  });

  if (r.ok) {
    await cargarSedes();
    const ok = document.getElementById('sede-guardado');
    ok.style.display = 'inline';
    setTimeout(() => ok.style.display = 'none', 2500);
  } else {
    const data = await r.json();
    alert('Error: ' + (data.error || 'no se pudo guardar'));
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  // El panel admin SIEMPRE pide el código de acceso, no se guarda sesión entre visitas.
  document.getElementById('admin-codigo').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') ingresarAdmin();
  });
});

async function inicializarPanel() {
  document.getElementById('f-fecha').value = hoyISO();
  document.getElementById('r-desde').value = hoyISO();
  document.getElementById('r-hasta').value = hoyISO();
  document.getElementById('rs-desde').value = inicioDeMes();
  document.getElementById('rs-hasta').value = hoyISO();
  await cargarUsuarios();
  await cargarSedes();
  await cargarTabla();
  await cargarResumen();
  await cargarUsuariosCompleto();
}

async function cargarUsuariosCompleto() {
  const rol = document.getElementById('uf-rol').value;
  const params = new URLSearchParams();
  if (rol) params.set('rol', rol);

  const r = await fetch(`${API}/admin/usuarios?${params}`);
  const data = await r.json();
  const tbody = document.getElementById('usuarios-completo-body');

  if (data.usuarios.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--slate-light); padding:24px;">Sin usuarios registrados todavía.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.usuarios.map(u => `
    <tr>
      <td class="name-cell">${u.nombre} ${u.apellido}</td>
      <td>${u.legajo}</td>
      <td>${u.rol}</td>
      <td>${u.sede_nombre}</td>
      <td style="font-weight:600;">${u.pin}</td>
      <td>${u.activo ? '<span class="badge completo">Activo</span>' : '<span class="badge incompleto">Inactivo</span>'}</td>
      <td style="white-space:nowrap;">
        <button class="btn-outline" style="padding:5px 10px; font-size:12px;" onclick="cambiarEstadoUsuario(${u.id}, ${u.activo ? 0 : 1})">
          ${u.activo ? 'Desactivar' : 'Activar'}
        </button>
        <button class="btn-outline" style="padding:5px 10px; font-size:12px; border-color:var(--alert); color:var(--alert); margin-left:6px;" onclick="eliminarUsuario(${u.id}, '${(u.nombre + ' ' + u.apellido).replace(/'/g, '')}')">
          Eliminar
        </button>
      </td>
    </tr>
  `).join('');
}

async function eliminarUsuario(id, nombre) {
  if (!confirm(`¿Eliminar a ${nombre} y todo su historial de asistencia? Esta acción no se puede deshacer.`)) return;
  await fetch(`${API}/admin/usuarios/${id}`, { method: 'DELETE' });
  await cargarUsuariosCompleto();
  await cargarResumen();
  await cargarUsuarios();
}

async function eliminarDatosDemo() {
  if (!confirm('¿Eliminar todos los usuarios de ejemplo (ADM-001, DOC-001, ALU-001, etc.) y su historial? Los usuarios registrados por personas reales NO se van a tocar.')) return;
  const r = await fetch(`${API}/admin/usuarios-demo`, { method: 'DELETE' });
  const data = await r.json();
  alert(`Se eliminaron ${data.eliminados} usuarios de ejemplo.`);
  await cargarUsuariosCompleto();
  await cargarResumen();
  await cargarUsuarios();
  await cargarTabla();
}

async function cambiarEstadoUsuario(id, nuevoEstado) {
  await fetch(`${API}/admin/usuarios/${id}/estado`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo: nuevoEstado })
  });
  await cargarUsuariosCompleto();
}

async function cargarResumen() {
  const desde = document.getElementById('rs-desde').value;
  const hasta = document.getElementById('rs-hasta').value;
  const rol = document.getElementById('rs-rol').value;
  const params = new URLSearchParams({ desde, hasta });
  if (rol) params.set('rol', rol);

  const r = await fetch(`${API}/reportes/resumen?${params}`);
  const data = await r.json();
  const tbody = document.getElementById('resumen-body');

  if (data.resumen.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--slate-light); padding:24px;">Sin datos para este filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.resumen.map(p => `
    <tr>
      <td class="name-cell">${p.apellido}, ${p.nombre}<br><span style="color:var(--slate-light); font-size:11.5px;">${p.legajo}</span></td>
      <td>${p.rol}</td>
      <td>${p.sede_nombre}</td>
      <td>${p.total_marcaciones}</td>
      <td>${p.dias_completos}</td>
      <td>${p.dias_incompletos > 0 ? `<span style="color:var(--alert); font-weight:600;">${p.dias_incompletos}</span>` : '0'}</td>
      <td>${p.total_horas} hs</td>
      <td>${p.ultima_fecha || '—'}</td>
      <td>
        <a href="/api/reportes/pdf/${p.usuario_id}?desde=${desde}&hasta=${hasta}" style="font-size:12px; text-decoration:underline; margin-right:8px;">PDF</a>
        <a href="/api/reportes/excel/${p.usuario_id}?desde=${desde}&hasta=${hasta}" style="font-size:12px; text-decoration:underline;">Excel</a>
      </td>
    </tr>
  `).join('');
}

async function cargarUsuarios() {
  const r = await fetch(`${API}/admin/usuarios`);
  const data = await r.json();
  usuarios = data.usuarios;
  const sel = document.getElementById('r-usuario');
  sel.innerHTML = usuarios.map(u =>
    `<option value="${u.id}">${u.apellido}, ${u.nombre} — ${u.legajo} (${u.rol})</option>`
  ).join('');
}

function badgeEstado(estado) {
  return estado === 'cerrada'
    ? '<span class="badge completo">Completo</span>'
    : '<span class="badge incompleto">Incompleto</span>';
}

function hora(ts) {
  return ts ? new Date(ts).toLocaleTimeString('es-PE', { hour12: false }) : '—';
}

async function cargarTabla() {
  const fecha = document.getElementById('f-fecha').value;
  const rol = document.getElementById('f-rol').value;
  const params = new URLSearchParams({ fecha });
  if (rol) params.set('rol', rol);

  const r = await fetch(`${API}/asistencia/todos?${params}`);
  const data = await r.json();
  const registros = data.registros;

  const tbody = document.getElementById('tabla-body');
  if (registros.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--slate-light); padding:24px;">Sin marcaciones para este día / filtro.</td></tr>`;
  } else {
    tbody.innerHTML = registros.map(reg => `
      <tr>
        <td class="name-cell">${reg.apellido}, ${reg.nombre}<br><span style="color:var(--slate-light); font-size:11.5px;">${reg.legajo}</span></td>
        <td>${reg.rol}</td>
        <td>${reg.sede_nombre}</td>
        <td>${hora(reg.ingreso_ts)}</td>
        <td>${reg.salida_ts ? hora(reg.salida_ts) : (reg.estado === 'abierta' ? '<span style="color:var(--alert)">Sin marcar</span>' : '—')}</td>
        <td>${reg.minutos_trabajados ? (reg.minutos_trabajados/60).toFixed(2) + ' hs' : '—'}</td>
        <td>${badgeEstado(reg.estado)}</td>
        <td><a href="/api/reportes/pdf/${reg.usuario_id}" style="font-size:12px; text-decoration:underline;">PDF</a></td>
      </tr>
    `).join('');
  }

  // stats
  const total = registros.length;
  const completos = registros.filter(r => r.estado === 'cerrada').length;
  const incompletos = total - completos;
  document.getElementById('stats').innerHTML = `
    <div class="stat"><div class="num">${total}</div><div class="lbl">Marcaciones del día</div></div>
    <div class="stat"><div class="num">${completos}</div><div class="lbl">Jornadas completas</div></div>
    <div class="stat"><div class="num">${incompletos}</div><div class="lbl">Sin salida marcada</div></div>
  `;
}

function descargarGeneralExcel() {
  const desde = document.getElementById('r-desde').value;
  const hasta = document.getElementById('r-hasta').value;
  const rol = document.getElementById('r-rol').value;
  const params = new URLSearchParams({ desde, hasta });
  if (rol) params.set('rol', rol);
  window.location.href = `${API}/reportes/excel-general?${params}`;
}

function descargarPersonaExcel() {
  const id = document.getElementById('r-usuario').value;
  const desde = document.getElementById('r-desde').value;
  const hasta = document.getElementById('r-hasta').value;
  window.location.href = `${API}/reportes/excel/${id}?desde=${desde}&hasta=${hasta}`;
}

function descargarPersonaPDF() {
  const id = document.getElementById('r-usuario').value;
  const desde = document.getElementById('r-desde').value;
  const hasta = document.getElementById('r-hasta').value;
  window.location.href = `${API}/reportes/pdf/${id}?desde=${desde}&hasta=${hasta}`;
}
