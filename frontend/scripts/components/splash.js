/**
 * Splash Screen Controller
 * Shown on the dashboard only, first time per session (`sessionStorage` key `cf_splash_shown`).
 * Fades out smoothly once the first batch of dashboard data renders.
 */
import { CONFIG } from '../config.js';

let splashEl = null;
let fillEl = null;

export function initSplash() {
  splashEl = document.getElementById('splash-overlay');
  fillEl = document.getElementById('splash-bar-fill');

  const isSplashShown = sessionStorage.getItem(CONFIG.STORAGE_SPLASH_SHOWN) === 'true';
  const isDashboard = window.location.pathname === '/' || window.location.pathname === '';

  if (isSplashShown || !isDashboard) {
    if (splashEl) {
      splashEl.classList.add('is-hidden');
    }
    return false;
  }

  // Animate progress bar incrementally while initial data is fetching
  if (fillEl) {
    fillEl.style.width = '20%';
    setTimeout(() => { if (fillEl) fillEl.style.width = '65%'; }, 300);
  }
  return true;
}

/**
 * Dismiss splash overlay
 */
export function dismissSplash() {
  if (fillEl) {
    fillEl.style.width = '100%';
  }
  setTimeout(() => {
    if (splashEl) {
      splashEl.classList.add('is-hidden');
    }
    sessionStorage.setItem(CONFIG.STORAGE_SPLASH_SHOWN, 'true');
  }, 350);
}
