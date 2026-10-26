/**
 * SOC Video Wall Header Controller
 * Manages live clock ticks, updated timestamp, seam debug toggle ('G' key), and logout.
 */
import { api } from '../core/api.js';
import { formatTimeSec } from '../core/time.js';
import { CONFIG } from '../config.js';

let clockTimer = null;

export function initHeader() {
  const clockEl = document.getElementById('live-clock');
  const seamOverlay = document.getElementById('seam-debug-overlay');
  const seamBtn = document.getElementById('seam-debug-toggle');
  const logoutBtn = document.getElementById('logout-btn');

  // Live 1-second clock
  function tickClock() {
    if (clockEl) {
      clockEl.textContent = formatTimeSec(new Date());
    }
  }
  tickClock();
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = setInterval(tickClock, CONFIG.CLOCK_TICK_MS);

  // Seam debug overlay toggle
  function toggleSeamDebug() {
    if (!seamOverlay) return;
    const isActive = seamOverlay.classList.toggle('is-active');
    localStorage.setItem(CONFIG.STORAGE_SEAM_DEBUG, isActive ? '1' : '0');
    if (seamBtn) {
      seamBtn.classList.toggle('btn-amber', isActive);
    }
  }

  // Restore saved seam debug state
  if (localStorage.getItem(CONFIG.STORAGE_SEAM_DEBUG) === '1' && seamOverlay) {
    seamOverlay.classList.add('is-active');
    if (seamBtn) seamBtn.classList.add('btn-amber');
  }

  if (seamBtn) {
    seamBtn.addEventListener('click', toggleSeamDebug);
  }

  // Keydown shortcut: 'G' key toggles seam debug overlay
  window.addEventListener('keydown', (e) => {
    // Only toggle if not actively typing in an input
    if (e.key === 'g' || e.key === 'G') {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
      toggleSeamDebug();
    }
  });

  // Logout handler
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      logoutBtn.disabled = true;
      try {
        await api.logout();
      } catch (err) {
        console.warn('Logout API error:', err);
      } finally {
        sessionStorage.removeItem(CONFIG.STORAGE_SPLASH_SHOWN);
        window.location.replace('/login');
      }
    });
  }
}

/**
 * Set the "UPDATED HH:MM:SS" time in the header
 * @param {Date|string|number} [date]
 */
export function setHeaderUpdatedTime(date = new Date()) {
  const updatedEl = document.getElementById('header-updated-time');
  if (updatedEl) {
    updatedEl.textContent = `UPDATED ${formatTimeSec(date)}`;
  }
}
