/**
 * Client-Side SPA Router
 * Handles History API navigation, lifecycle hooks, and dirty auto-save guards.
 */

export class Router {
  /**
   * @param {Record<string, { mount: (container: HTMLElement) => Promise<any>|void, unmount: () => void }>} routes
   * @param {HTMLElement} mountContainer
   * @param {() => Promise<boolean>} [beforeNavigateHook]
   */
  constructor(routes, mountContainer, beforeNavigateHook = null) {
    this.routes = routes;
    this.mountContainer = mountContainer;
    this.beforeNavigateHook = beforeNavigateHook;
    this.currentRoute = null;
    this.activePage = null;

    window.addEventListener('popstate', () => {
      this.resolve(window.location.pathname, false);
    });

    // Intercept navigation clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-route]');
      if (link && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        const path = link.getAttribute('href');
        this.navigate(path);
      }
    });
  }

  /**
   * Navigate to path
   * @param {string} path
   */
  async navigate(path) {
    if (this.currentRoute === path) return;

    // Check before-navigate hook (e.g. Settings unsaved auto-save)
    if (this.beforeNavigateHook) {
      try {
        const canContinue = await this.beforeNavigateHook();
        if (canContinue === false) return;
      } catch (err) {
        console.error('Navigation hook error:', err);
      }
    }

    window.history.pushState(null, '', path);
    await this.resolve(path, true);
  }

  /**
   * Resolve current route and mount page
   * @param {string} rawPath
   * @param {boolean} [showLoader=true]
   */
  async resolve(rawPath, showLoader = true) {
    let path = rawPath.replace(/\/$/, '') || '/';
    if (!this.routes[path]) {
      path = '/';
    }

    // Unmount previous active page
    if (this.activePage && typeof this.activePage.unmount === 'function') {
      try {
        this.activePage.unmount();
      } catch (e) {
        console.error('Error unmounting page:', e);
      }
      this.activePage = null;
    }

    this.currentRoute = path;
    this.updateActiveNavTab(path);

    // Update body classes for scrollability
    if (path === '/settings') {
      this.mountContainer.classList.add('wall-container--scrollable');
    } else {
      this.mountContainer.classList.remove('wall-container--scrollable');
    }

    // Show tab transition loader
    const tabLoader = document.getElementById('tab-loader');
    if (showLoader && tabLoader) {
      tabLoader.classList.add('is-active');
    }

    const pageDef = this.routes[path];
    this.activePage = pageDef;

    try {
      await pageDef.mount(this.mountContainer);
    } catch (err) {
      console.error(`Error mounting page ${path}:`, err);
    } finally {
      if (tabLoader) {
        tabLoader.classList.remove('is-active');
      }
      // Re-trigger icon hydration
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  }

  /**
   * Highlight active nav tab
   * @param {string} path
   */
  updateActiveNavTab(path) {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach((tab) => {
      const tabPath = tab.getAttribute('href');
      if (tabPath === path || (path === '/' && tabPath === '/')) {
        tab.classList.add('is-active');
      } else {
        tab.classList.remove('is-active');
      }
    });
  }
}
