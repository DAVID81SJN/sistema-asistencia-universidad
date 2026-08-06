// Service worker mínimo: no cachea nada (el sistema necesita datos siempre
// actualizados y en vivo), solo existe para cumplir el requisito técnico que
// Chrome/Android piden para permitir "Instalar app" desde el navegador.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', () => { /* siempre va directo a la red */ });
