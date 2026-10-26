/**
 * Subdomains Overview Page Module
 * Displays primary zone subdomains grid, 10-row Top Paths, 10-row Top IPs, and Secondary Zones.
 * Split across 50% seam line to avoid any elements touching the monitor bezel.
 */
import { api, ApiError } from '../core/api.js';
import { el, clearChildren } from '../core/dom.js';
import { formatCompact, formatInt, formatPercent } from '../core/format.js';
import { PageScheduler } from '../core/scheduler.js';
import { setHeaderUpdatedTime } from '../components/header.js';
import { RankTable } from '../components/rank-table.js';
import { createTelemetryLineChart, updateTelemetryLineChart } from '../components/line-chart.js';
import { renderEmptyState } from '../components/empty-state.js';
import { CONFIG } from '../config.js';

let abortCtrl = null;
let refreshScheduler = null;

// Chart instances map: subdomainName -> Chart instance
let subdomainCharts = new Map();
let pathsTableInstance = null;
let ipsTableInstance = null;

export async function mount(container) {
  abortCtrl = new AbortController();
  clearChildren(container);

  // Build two-screen wall structure
  const topScreen = el('div', { class: 'screen-zone screen-zone--top', id: 'sub-top-zone' });
  const seamGutter = el('div', { class: 'wall-seam-gutter' });
  const bottomScreen = el('div', { class: 'screen-zone screen-zone--bottom', id: 'sub-bottom-zone' });

  container.appendChild(topScreen);
  container.appendChild(seamGutter);
  container.appendChild(bottomScreen);

  renderSubdomainsStructure(topScreen, bottomScreen);

  await loadSubdomainData(true);

  refreshScheduler = new PageScheduler(() => {
    loadSubdomainData(false);
  }, CONFIG.REFRESH_INTERVAL_MS);
}

export function unmount() {
  if (abortCtrl) {
    abortCtrl.abort();
    abortCtrl = null;
  }
  if (refreshScheduler) {
    refreshScheduler.destroy();
    refreshScheduler = null;
  }

  // Destroy all active Chart instances
  for (const chart of subdomainCharts.values()) {
    chart.destroy();
  }
  subdomainCharts.clear();
}

/**
 * Render basic structural shell for top and bottom zones
 */
function renderSubdomainsStructure(topScreen, bottomScreen) {
  // Top Screen Zone: Primary Zone Banner + Subdomains Grid
  const topContent = el('div', { class: 'subdomains-top-content' }, [
    el('div', { class: 'subdomain-primary-banner', id: 'primary-zone-banner' }, [
      el('div', { class: 'banner-domain-lockup' }, [
        el('span', { class: 'banner-domain-title', id: 'primary-zone-name', textContent: 'PRIMARY ZONE' }),
        el('span', { class: 'banner-domain-range', id: 'primary-zone-range', textContent: 'LAST 30 MINUTES' })
      ]),
      el('div', { class: 'banner-traffic-kpi' }, [
        el('span', { class: 'micro-label', textContent: 'TOTAL SUBDOMAIN TRAFFIC:' }),
        el('span', { class: 'banner-traffic-val', id: 'primary-zone-traffic', textContent: '—' })
      ])
    ]),
    el('div', { class: 'subdomains-charts-grid', id: 'subdomains-grid' })
  ]);
  topScreen.appendChild(topContent);

  // Bottom Screen Zone: Paths Table + IPs Table + Secondary Zones
  const bottomContent = el('div', { class: 'subdomains-bottom-content' }, [
    el('div', { id: 'top-paths-wrap', style: 'height: 100%; min-height: 0;' }),
    el('div', { id: 'top-ips-wrap', style: 'height: 100%; min-height: 0;' }),
    el('div', { id: 'secondary-zones-wrap', style: 'height: 100%; min-height: 0;' })
  ]);
  bottomScreen.appendChild(bottomContent);

  // Initialize 10-row tables
  const pathsWrap = document.getElementById('top-paths-wrap');
  if (pathsWrap) {
    pathsTableInstance = new RankTable(pathsWrap, 'TOP PATHS', 'globe');
  }

  const ipsWrap = document.getElementById('top-ips-wrap');
  if (ipsWrap) {
    ipsTableInstance = new RankTable(ipsWrap, 'TOP CLIENT IPs', 'network');
  }
}

/**
 * Fetch subdomain overview data and update views
 * @param {boolean} isInitial
 */
async function loadSubdomainData(isInitial = false) {
  try {
    const data = await api.getSubdomainOverview(abortCtrl?.signal);

    // Update primary banner
    const nameEl = document.getElementById('primary-zone-name');
    const rangeEl = document.getElementById('primary-zone-range');
    const trafficEl = document.getElementById('primary-zone-traffic');

    if (nameEl) nameEl.textContent = data.zone_name || 'PRIMARY ZONE';
    if (rangeEl) rangeEl.textContent = (data.range || 'LAST 30 MINUTES').toUpperCase();

    const subdomains = data.subdomains || [];
    const totalReqs = subdomains.reduce((sum, s) => sum + (Number(s.total_requests) || 0), 0);
    if (trafficEl) trafficEl.textContent = formatCompact(totalReqs);

    // Render / update primary subdomains charts
    renderSubdomainCharts(subdomains);

    // Update Top Paths (10 rows)
    if (pathsTableInstance) {
      pathsTableInstance.update(data.top_paths || []);
    }

    // Update Top IPs (10 rows)
    if (ipsTableInstance) {
      ipsTableInstance.update(data.top_ips || []);
    }

    // Update Secondary Zones
    renderSecondaryZones(data.secondary_zones || []);

    // Set updated time in header
    setHeaderUpdatedTime(data.server_time || new Date());
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('Subdomains fetch error:', err);

    if (isInitial) {
      const topScreen = document.getElementById('sub-top-zone');
      if (topScreen) {
        clearChildren(topScreen);
        const isConfigError = err.status === 400 || (err.detail && err.detail.toLowerCase().includes('subdomain'));
        topScreen.appendChild(renderEmptyState({
          title: isConfigError ? 'SUBDOMAINS NOT CONFIGURED' : 'ANALYTICS UNAVAILABLE',
          desc: err.detail || 'Configure your target subdomains in the Settings view to start receiving live telemetry.',
          icon: isConfigError ? 'settings' : 'alert-triangle',
          actionLabel: isConfigError ? 'OPEN SETTINGS' : 'RETRY',
          onAction: () => {
            if (isConfigError) {
              window.history.pushState(null, '', '/settings');
              window.dispatchEvent(new PopStateEvent('popstate'));
            } else {
              loadSubdomainData(true);
            }
          }
        }));
      }
    }
  }
}

/**
 * Render or in-place update subdomain charts grid
 * @param {Array<object>} subdomains
 */
function renderSubdomainCharts(subdomains) {
  const grid = document.getElementById('subdomains-grid');
  if (!grid) return;

  // Adapt column class based on count: <=2 -> 1 col, <=4 -> 2 cols, else 3 cols
  const count = subdomains.length;
  grid.className = 'subdomains-charts-grid';
  if (count <= 2) {
    grid.classList.add('subdomains-charts-grid--cols-1');
  } else if (count <= 4) {
    grid.classList.add('subdomains-charts-grid--cols-2');
  } else {
    grid.classList.add('subdomains-charts-grid--cols-3');
  }

  // If number of subdomains changed, reconstruct DOM cards
  const existingCardCount = grid.querySelectorAll('.zone-card').length;
  if (existingCardCount !== count) {
    // Destroy previous charts
    for (const c of subdomainCharts.values()) {
      c.destroy();
    }
    subdomainCharts.clear();
    clearChildren(grid);

    subdomains.forEach((sub) => {
      const card = createSubdomainCard(sub);
      grid.appendChild(card);
    });
  } else {
    // In-place update existing charts and values
    subdomains.forEach((sub) => {
      const card = grid.querySelector(`[data-sub-name="${sub.name}"]`);
      if (card) {
        const valEl = card.querySelector('.zone-card-value');
        const deltaEl = card.querySelector('.zone-card-delta');
        if (valEl) valEl.textContent = formatCompact(sub.total_requests);

        const delta = Number(sub.percent_change) || 0;
        if (deltaEl) {
          if (delta === 0) {
            deltaEl.style.display = 'none';
          } else {
            deltaEl.style.display = 'inline-flex';
            deltaEl.className = `zone-card-delta ${delta > 0 ? 'zone-card-delta--up' : 'zone-card-delta--down'}`;
            deltaEl.textContent = `${delta > 0 ? '▲' : '▼'} ${formatPercent(delta)}`;
          }
        }

        const chart = subdomainCharts.get(sub.name);
        if (chart) {
          updateTelemetryLineChart(chart, sub.data || []);
        }
      }
    });
  }
}

/**
 * Helper to construct a single subdomain chart card
 */
function createSubdomainCard(sub) {
  const delta = Number(sub.percent_change) || 0;
  const deltaClass = delta > 0 ? 'zone-card-delta--up' : (delta < 0 ? 'zone-card-delta--down' : 'zone-card-delta--neutral');
  const deltaSign = delta > 0 ? '▲' : (delta < 0 ? '▼' : '');

  const canvas = document.createElement('canvas');

  const card = el('div', { class: 'zone-card', 'data-sub-name': sub.name }, [
    el('div', { class: 'zone-card-top' }, [
      el('div', { class: 'zone-card-meta' }, [
        el('span', { class: 'zone-card-name', textContent: sub.name }),
        el('span', { class: 'micro-label', textContent: 'REAL-TIME 1M PTS' })
      ]),
      el('div', { class: 'zone-card-kpi' }, [
        el('span', { class: 'zone-card-value', textContent: formatCompact(sub.total_requests) }),
        delta !== 0 ? el('span', { class: `zone-card-delta ${deltaClass}`, textContent: `${deltaSign} ${formatPercent(delta)}` }) : null
      ])
    ]),
    el('div', { class: 'zone-card-chart-wrap' }, [canvas])
  ]);

  requestAnimationFrame(() => {
    const chart = createTelemetryLineChart(canvas, sub.data || []);
    if (chart) {
      subdomainCharts.set(sub.name, chart);
    }
  });

  return card;
}

/**
 * Render secondary zones card with relative horizontal amber bars
 */
function renderSecondaryZones(secondaryZones) {
  const wrap = document.getElementById('secondary-zones-wrap');
  if (!wrap) return;
  clearChildren(wrap);

  const card = el('div', { class: 'secondary-zones-card' }, [
    el('div', { class: 'soc-card-header', style: 'padding: 4px 0 6px;' }, [
      el('span', { class: 'micro-label', textContent: 'SECONDARY ZONES MONITOR' }),
      el('span', { class: 'badge badge--plan-pro', textContent: `${secondaryZones.length} ACTIVE` })
    ])
  ]);

  if (secondaryZones.length === 0) {
    card.appendChild(el('div', { style: 'display: flex; align-items: center; justify-content: center; height: 100%;' }, [
      el('span', { class: 'micro-label', textContent: 'NO SECONDARY ZONES CONFIGURED' })
    ]));
    wrap.appendChild(card);
    return;
  }

  secondaryZones.forEach((sec) => {
    const topSubs = sec.top_subdomains || [];
    const topPaths = sec.top_paths || [];

    // Max requests among top subdomains for relative bar width
    const maxSubReqs = topSubs.reduce((max, s) => Math.max(max, Number(s.total_requests) || 0), 1);

    const block = el('div', { class: 'secondary-zone-block' }, [
      el('div', { class: 'secondary-zone-title' }, [
        el('span', { textContent: sec.zone_name }),
        el('span', { class: 'micro-label', textContent: 'SECONDARY' })
      ]),
      // Top 3 Subdomains with relative bars
      el('div', { style: 'display: flex; flex-direction: column; gap: 4px;' }, [
        el('span', { class: 'micro-label', style: 'font-size: 8px;', textContent: 'TOP SUBDOMAINS' }),
        ...topSubs.slice(0, 3).map((sub) => {
          const reqs = Number(sub.total_requests) || 0;
          const pct = Math.min(100, Math.round((reqs / maxSubReqs) * 100));
          return el('div', { class: 'secondary-sub-row' }, [
            el('span', { class: 'rank-val', textContent: sub.name, title: sub.name }),
            el('div', { class: 'secondary-bar-track' }, [
              el('div', { class: 'secondary-bar-fill', style: `width: ${pct}%;` })
            ]),
            el('span', { class: 'rank-count', textContent: formatInt(reqs) })
          ]);
        })
      ]),
      // Top 3 Requested Paths
      el('div', { style: 'display: flex; flex-direction: column; gap: 2px; margin-top: 4px;' }, [
        el('span', { class: 'micro-label', style: 'font-size: 8px;', textContent: 'TOP REQUESTED PATHS' }),
        ...topPaths.slice(0, 3).map((p) => {
          return el('div', { style: 'display: flex; align-items: center; justify-content: space-between; font-family: var(--font-mono); font-size: 10px;' }, [
            el('span', { class: 'rank-val', style: 'max-width: 140px;', textContent: p.path, title: p.path }),
            el('span', { class: 'rank-count', textContent: formatInt(p.requests) })
          ]);
        })
      ])
    ]);

    card.appendChild(block);
  });

  wrap.appendChild(card);
}
