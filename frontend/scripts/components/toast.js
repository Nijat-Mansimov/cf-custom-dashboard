/**
 * Toast Notification Helper
 */
import { el } from '../core/dom.js';

let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = el('div', {
      style: 'position: fixed; bottom: 24px; right: 24px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; pointer-events: none;'
    });
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Show temporary toast message
 * @param {string} msg
 * @param {'success'|'error'|'info'} [type='info']
 * @param {number} [durationMs=2500]
 */
export function showToast(msg, type = 'info', durationMs = 2500) {
  const container = ensureToastContainer();

  const colors = {
    success: 'background-color: #141418; border: 1px solid #22C55E; color: #22C55E;',
    error: 'background-color: #141418; border: 1px solid #EF4444; color: #EF4444;',
    info: 'background-color: #141418; border: 1px solid #FFC21A; color: #FFC21A;'
  };

  const toast = el('div', {
    style: `${colors[type]} padding: 8px 16px; border-radius: 6px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600; box-shadow: 0 4px 16px rgba(0,0,0,0.6); pointer-events: auto; transition: all 0.25s ease; opacity: 0; transform: translateY(10px);`,
    textContent: msg
  });

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 250);
  }, durationMs);
}
