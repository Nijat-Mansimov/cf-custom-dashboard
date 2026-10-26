/**
 * Fixed 10-Row Telemetry Rank Table (TOP PATHS & TOP IPs)
 * Missing rows are padded with dimmed '-' and '0'.
 */
import { el, clearChildren } from '../core/dom.js';
import { formatInt } from '../core/format.js';
import { CONFIG } from '../config.js';

export class RankTable {
  /**
   * @param {HTMLElement} container
   * @param {string} title
   * @param {string} [iconName='activity']
   */
  constructor(container, title, iconName = 'activity') {
    this.container = container;
    this.title = title;
    this.iconName = iconName;
    this.render();
  }

  render() {
    clearChildren(this.container);

    this.bodyEl = el('div', { class: 'rank-table-body' });

    const card = el('div', { class: 'rank-table-card' }, [
      el('div', { class: 'rank-table-header' }, [
        el('div', { class: 'rank-table-title' }, [
          el('i', { 'data-lucide': this.iconName, style: 'width: 14px; height: 14px;' }),
          el('span', { textContent: this.title })
        ]),
        el('span', { class: 'micro-label', textContent: 'TOP 10' })
      ]),
      this.bodyEl
    ]);

    this.container.appendChild(card);
    this.update([]); // Initial 10 empty rows
  }

  /**
   * Update table with items
   * @param {Array<{ path?: string, ip?: string, requests: number }>} items
   */
  update(items = []) {
    if (!this.bodyEl) return;
    clearChildren(this.bodyEl);

    for (let i = 0; i < CONFIG.TOP_PATHS_COUNT; i++) {
      const item = items[i];
      const rankNum = String(i + 1).padStart(2, '0');

      if (item) {
        const val = item.path || item.ip || '—';
        const count = item.requests || 0;
        const row = el('div', { class: 'rank-row' }, [
          el('span', { class: 'rank-num', textContent: rankNum }),
          el('span', { class: 'rank-val', title: val, textContent: val }),
          el('span', { class: 'rank-count', textContent: formatInt(count) })
        ]);
        this.bodyEl.appendChild(row);
      } else {
        // Padded empty row
        const emptyRow = el('div', { class: 'rank-row rank-row--empty' }, [
          el('span', { class: 'rank-num', textContent: rankNum }),
          el('span', { class: 'rank-val', textContent: '—' }),
          el('span', { class: 'rank-count', textContent: '0' })
        ]);
        this.bodyEl.appendChild(emptyRow);
      }
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: this.container });
    }
  }
}
