/**
 * Page-Aware Scheduler
 * Handles polling intervals, auto-cycles, and pauses during document.hidden.
 */

export class PageScheduler {
  /**
   * @param {() => Promise<void>|void} callback
   * @param {number} intervalMs
   */
  constructor(callback, intervalMs) {
    this.callback = callback;
    this.intervalMs = intervalMs;
    this.timerId = null;
    this.isDestroyed = false;
    this.handleVisibility = this.handleVisibility.bind(this);

    document.addEventListener('visibilitychange', this.handleVisibility);
    this.start();
  }

  start() {
    this.stopTimer();
    if (this.isDestroyed) return;
    this.timerId = setInterval(() => {
      if (!document.hidden && !this.isDestroyed) {
        this.callback();
      }
    }, this.intervalMs);
  }

  stopTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  handleVisibility() {
    if (this.isDestroyed) return;
    if (!document.hidden) {
      // Tab became visible again: trigger immediate refresh and restart interval
      this.callback();
      this.start();
    } else {
      this.stopTimer();
    }
  }

  destroy() {
    this.isDestroyed = true;
    this.stopTimer();
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }
}
