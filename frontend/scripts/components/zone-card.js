/**
 * Zone Card Component
 * Displays zone name, plan badge, total requests, percent change, and line chart.
 * Supports in-place updates without DOM reconstruction.
 */
import { el } from '../core/dom.js';
import { formatCompact, formatPercent } from '../core/format.js';
import { createTelemetryLineChart, updateTelemetryLineChart } from './line-chart.js';

export class ZoneCard {
  /**
   * @param {object} zoneData
   */
  constructor(zoneData) {
    this.zoneId = zoneData.zone_id || zoneData.id;
    this.chart = null;
    this.element = this.createElement(zoneData);
  }

  createElement(data) {
    const totalReqs = data.data 
      ? data.data.reduce((sum, p) => sum + (Number(p.requests) || 0), 0)
      : (data.total_requests || 0);

    const plan = (data.plan || 'free').toLowerCase();

    // Plan badge text
    const planLabels = {
      enterprise: 'ENT',
      business: 'BUS',
      pro: 'PRO',
      free: 'FREE'
    };
    const planText = planLabels[plan] || plan.toUpperCase();

    // Delta calculation
    const deltaVal = Number(data.percent_change) || 0;
    const deltaClass = deltaVal > 0 
      ? 'zone-card-delta--up' 
      : (deltaVal < 0 ? 'zone-card-delta--down' : 'zone-card-delta--neutral');
    const deltaSign = deltaVal > 0 ? '▲' : (deltaVal < 0 ? '▼' : '—');

    this.valEl = el('span', { class: 'zone-card-value', textContent: formatCompact(totalReqs) });
    this.deltaEl = el('span', { 
      class: `zone-card-delta ${deltaClass}`, 
      textContent: `${deltaSign} ${formatPercent(deltaVal)}` 
    });

    this.planBadge = el('span', { 
      class: `badge badge--plan-${plan}`, 
      textContent: planText 
    });

    this.canvas = document.createElement('canvas');

    const card = el('div', { class: 'zone-card', 'data-zone-id': this.zoneId }, [
      el('div', { class: 'zone-card-top' }, [
        el('div', { class: 'zone-card-meta' }, [
          el('span', { class: 'zone-card-name', textContent: data.zone_name || data.name || this.zoneId }),
          el('div', { class: 'zone-card-badges' }, [
            this.planBadge,
            el('span', { class: 'micro-label', textContent: data.range || '30M' })
          ])
        ]),
        el('div', { class: 'zone-card-kpi' }, [
          this.valEl,
          this.deltaEl
        ])
      ]),
      el('div', { class: 'zone-card-chart-wrap' }, [
        this.canvas
      ])
    ]);

    // Initialize chart
    requestAnimationFrame(() => {
      this.chart = createTelemetryLineChart(this.canvas, data.data || []);
    });

    return card;
  }

  /**
   * In-place update with new analytics data
   * @param {object} newData
   */
  update(newData) {
    const totalReqs = newData.data 
      ? newData.data.reduce((sum, p) => sum + (Number(p.requests) || 0), 0)
      : (newData.total_requests || 0);

    this.valEl.textContent = formatCompact(totalReqs);

    const deltaVal = Number(newData.percent_change) || 0;
    const deltaClass = deltaVal > 0 
      ? 'zone-card-delta--up' 
      : (deltaVal < 0 ? 'zone-card-delta--down' : 'zone-card-delta--neutral');
    const deltaSign = deltaVal > 0 ? '▲' : (deltaVal < 0 ? '▼' : '—');

    this.deltaEl.className = `zone-card-delta ${deltaClass}`;
    this.deltaEl.textContent = `${deltaSign} ${formatPercent(deltaVal)}`;

    // Update chart without flicker
    if (this.chart) {
      updateTelemetryLineChart(this.chart, newData.data || []);
    }
  }

  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}
