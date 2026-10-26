/**
 * KPI Tile Helper Component
 */
import { el } from '../core/dom.js';

export function renderKpiTile(label, value, subtext = '', variant = 'amber') {
  return el('div', { class: `kpi-tile kpi-tile--${variant}` }, [
    el('span', { class: 'kpi-label', textContent: label }),
    el('div', { class: 'kpi-value-row' }, [
      el('span', { class: `kpi-value ${variant === 'amber' ? 'kpi-value--amber' : ''}`, textContent: value }),
      subtext ? el('span', { class: 'kpi-subtext', textContent: subtext }) : null
    ])
  ]);
}
