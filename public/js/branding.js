// Carga el nombre de la institución/sede configurado por el administrador
// y lo muestra en el encabezado de cualquier página que incluya este script.
(async function cargarBranding() {
  try {
    const r = await fetch('/api/auth/config-publica');
    const config = await r.json();
    const el = document.getElementById('eyebrow-institucion');
    if (el && config.nombre_institucion) {
      el.textContent = config.nombre_institucion + (config.nombre_sede ? ' · ' + config.nombre_sede : '');
    }
    if (config.nombre_institucion) {
      document.title = document.title.split('|')[0] + '| ' + config.nombre_institucion;
    }
  } catch (e) { /* si falla, se mantiene el texto por defecto */ }
})();

// Registra el service worker necesario para que el sistema se pueda "instalar"
// como app desde el navegador (Android muestra el botón solo; en iPhone la
// persona lo hace manual desde Safari: Compartir -> Agregar a pantalla de inicio).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* no es crítico si falla */ });
  });
}
