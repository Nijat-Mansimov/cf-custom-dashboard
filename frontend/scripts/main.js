/**
 * Main Application Bootstrap (Native ES Module)
 * Orchestrates Header, Splash Screen, SPA Router, and Icon Hydration.
 */
import { initHeader } from './components/header.js';
import { initSplash } from './components/splash.js';
import { Router } from './core/router.js';

import * as dashboardPage from './pages/dashboard.js';
import * as subdomainsPage from './pages/subdomains.js';
import * as settingsPage from './pages/settings.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Header tickers & listeners
  initHeader();

  // Initialize Splash Screen (only displays on dashboard on first session load)
  initSplash();

  // Hydrate Lucide icons across static DOM
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  // Mount container
  const pageContainer = document.getElementById('app-main');
  if (!pageContainer) {
    console.error('Missing #app-main container element');
    return;
  }

  // Route registry
  const routes = {
    '/': dashboardPage,
    '/subdomains': subdomainsPage,
    '/settings': settingsPage
  };

  // Instantiate Router with Settings auto-save guard
  const router = new Router(routes, pageContainer, async () => {
    // If currently on settings, trigger auto-save before navigating away
    if (window.location.pathname === '/settings') {
      return await settingsPage.autoSaveIfDirty();
    }
    return true;
  });

  // Expose router globally for programmatic navigation
  window.__SOC_ROUTER__ = router;

  // Resolve initial route
  await router.resolve(window.location.pathname, false);
});
