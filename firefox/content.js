/**
 * Pushly Cookie Sync - Content Script (Firefox)
 * Injeta marcador na página para que o painel detecte a extensão instalada.
 */

window.dispatchEvent(new CustomEvent('pushly-extension-ready', { detail: { version: '1.0.0' } }));

const marker = document.createElement('div');
marker.id = '__pushly_extension__';
marker.setAttribute('data-version', '1.0.0');
marker.style.display = 'none';
document.documentElement.appendChild(marker);
