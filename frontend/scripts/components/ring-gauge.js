/**
 * Pure SVG Ring / Donut Gauge Component
 * Visual match for the reference image's circular telemetry arc.
 */
import { el, clearChildren } from '../core/dom.js';
import { formatCompact } from '../core/format.js';

export class RingGauge {
  /**
   * @param {HTMLElement} container
   * @param {object} [options]
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.radius = 36;
    this.circumference = 2 * Math.PI * this.radius; // ≈ 226.19
    this.renderSkeleton();
  }

  renderSkeleton() {
    clearChildren(this.container);

    this.card = el('div', { class: 'gauge-card' }, [
      el('div', { class: 'gauge-header' }, [
        el('span', { class: 'micro-label', textContent: this.options.title || 'TRAFFIC SHARE' }),
        el('span', { class: 'badge badge--plan-enterprise', textContent: 'TOP ZONES' })
      ]),
      el('div', { class: 'gauge-content' }, [
        // SVG Ring Wrapper
        el('div', { class: 'gauge-svg-wrap' }, [
          (() => {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 90 90');
            svg.setAttribute('class', 'gauge-svg');

            // Background circle
            const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            bgCircle.setAttribute('cx', '45');
            bgCircle.setAttribute('cy', '45');
            bgCircle.setAttribute('r', String(this.radius));
            bgCircle.setAttribute('class', 'gauge-circle-bg');

            // Foreground arc
            this.arcCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            this.arcCircle.setAttribute('cx', '45');
            this.arcCircle.setAttribute('cy', '45');
            this.arcCircle.setAttribute('r', String(this.radius));
            this.arcCircle.setAttribute('class', 'gauge-circle-arc');
            this.arcCircle.setAttribute('stroke-dasharray', `${this.circumference} ${this.circumference}`);
            this.arcCircle.setAttribute('stroke-dashoffset', String(this.circumference));

            svg.appendChild(bgCircle);
            svg.appendChild(this.arcCircle);
            return svg;
          })(),
          // Center Text Readout
          el('div', { class: 'gauge-center-text' }, [
            this.centerVal = el('span', { class: 'gauge-center-val', textContent: '0%' }),
            this.centerLbl = el('span', { class: 'gauge-center-lbl', textContent: 'SHARE' })
          ])
        ]),
        // Legend Breakdown List
        this.legendEl = el('div', { class: 'gauge-legend' })
      ])
    ]);

    this.container.appendChild(this.card);
  }

  /**
   * Update ring gauge with top zones data
   * @param {Array<{ name: string, requests: number }>} zones
   * @param {number} totalRequests
   */
  update(zones = [], totalRequests = 0) {
    if (!this.arcCircle || !this.legendEl) return;

    const topShare = totalRequests > 0 && zones.length > 0 
      ? Math.min(100, Math.round((zones[0].requests / totalRequests) * 100))
      : 0;

    // Calculate arc offset
    const offset = this.circumference - (topShare / 100) * this.circumference;
    this.arcCircle.setAttribute('stroke-dashoffset', String(offset));
    this.centerVal.textContent = `${topShare}%`;

    // Populate legend with top 3 zones
    clearChildren(this.legendEl);
    const top3 = zones.slice(0, 3);

    top3.forEach((z) => {
      const pct = totalRequests > 0 ? Math.round((z.requests / totalRequests) * 100) : 0;
      const row = el('div', { class: 'gauge-legend-row' }, [
        el('span', { class: 'gauge-legend-name', textContent: z.name }),
        el('span', { class: 'gauge-legend-pct', textContent: `${pct}% (${formatCompact(z.requests)})` })
      ]);
      this.legendEl.appendChild(row);
    });

    if (top3.length === 0) {
      this.legendEl.appendChild(el('span', { class: 'micro-label', textContent: 'NO TRAFFIC' }));
    }
  }
}
