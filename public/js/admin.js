const API = '/api';
let usuarios = [];

function hoyISO() { return new Date().toISOString().slice(0,10); }

function inicioDeMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('f-fecha').value = hoyISO();
  document.getElementById('r-desde').value = hoyISO();
  document.getElementById('r-hasta').value = hoyISO();
  document.getElementById('rs-desde').value = inicioDeMes();
  document.getElementById('rs-hasta').value = hoyISO();
  await cargarUsuarios();
  await cargarTabla();
  await cargarResumen();
});

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
