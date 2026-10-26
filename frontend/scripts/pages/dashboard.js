/**
 * Dashboard Page Module
 * Dual-screen SOC video wall layout (Top & Bottom halves separated at 50% seam).
 * In-place updates, parallel analytics fetching, auto-cycling pagination, SVG ring gauge.
 */
import { api, ApiError } from '../core/api.js';
import { el, clearChildren } from '../core/dom.js';
import { formatCompact, formatPercent } from '../core/format.js';
import { mapConcurrentSettled } from '../core/concurrency.js';
import { PageScheduler } from '../core/scheduler.js';
import { setHeaderUpdatedTime } from '../components/header.js';
import { dismissSplash } from '../components/splash.js';
import { ZoneCard } from '../components/zone-card.js';
import { RingGauge } from '../components/ring-gauge.js';
import { renderEmptyState } from '../components/empty-state.js';
import { CONFIG } from '../config.js';

let abortCtrl = null;
let refreshScheduler = null;
let cycleTimer = null;
let cycleProgressTimer = null;
let cycleStartTime = Date.now();

// State cache
let activeZonesWithTraffic = [];
let currentPage = 1;
let cardInstancesMap = new Map(); // zoneId -> ZoneCard instance
let topGaugeInstance = null;

export async function mount(container) {
  abortCtrl = new AbortController();
  clearChildren(container);
  currentPage = 1;

  // Build the two-screen wall layout container
  const topScreen = el('div', { class: 'screen-zone screen-zone--top', id: 'dash-top-zone' });
  const seamGutter = el('div', { class: 'wall-seam-gutter' });
  const bottomScreen = el('div', { class: 'screen-zone screen-zone--bottom', id: 'dash-bottom-zone' });

  container.appendChild(topScreen);
  container.appendChild(seamGutter);
  container.appendChild(bottomScreen);

  // Initial render skeletons
  renderDashboardStructure(topScreen, bottomScreen);

  // Fetch initial data
  await loadDashboardData(true);

  // Start 60-second in-place refresh scheduler
  refreshScheduler = new PageScheduler(() => {
    loadDashboardData(false);
  }, CONFIG.REFRESH_INTERVAL_MS);

  // Start 30-second auto-cycle pagination timer
  startAutoCycle();
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
  if (cycleTimer) {
    clearInterval(cycleTimer);
    cycleTimer = null;
  }
  if (cycleProgressTimer) {
    clearInterval(cycleProgressTimer);
    cycleProgressTimer = null;
  }

  // Destroy all active Chart.js card instances
  for (const card of cardInstancesMap.values()) {
    card.destroy();
  }
  cardInstancesMap.clear();
  activeZonesWithTraffic = [];
}

/**
 * Render the static structural layout of Top & Bottom screen zones
 */
function renderDashboardStructure(topScreen, bottomScreen) {
  // --- TOP SCREEN ZONE ---
  const topContent = el('div', { class: 'dashboard-top-content' }, [
    // Top KPI Strip
    el('div', { class: 'kpi-strip', id: 'dash-kpi-strip' }, [
      renderKpiSkeleton('ACTIVE ZONES', '—', 'MONITORED', 'amber'),
      renderKpiSkeleton('TOTAL REQUESTS', '—', 'CURRENT WINDOW', 'orange'),
      renderKpiSkeleton('TOP GROWTH', '—', 'HIGHEST SURGE', 'green'),
      renderKpiSkeleton('TOP DECLINE', '—', 'LARGEST DROP', 'blue')
    ]),
    // Top Row Visualizations Grid
    el('div', { class: 'dashboard-top-grid' }, [
      el('div', { id: 'dash-ring-gauge-wrap', style: 'height: 100%; min-height: 0;' }),
      el('div', { class: 'soc-card', id: 'dash-velocity-ranking-card' }, [
        el('div', { class: 'soc-card-header' }, [
          el('span', { class: 'micro-label', textContent: 'TRAFFIC VELOCITY' }),
          el('span', { class: 'badge badge--plan-enterprise', textContent: 'RANK' })
        ]),
        el('div', { class: 'soc-card-body', id: 'dash-velocity-list', style: 'gap: 4px; justify-content: space-between;' })
      ]),
      el('div', { class: 'dashboard-top-cards', id: 'dash-top-tier-cards' })
    ])
  ]);
  topScreen.appendChild(topContent);

  // Initialize Ring Gauge in Top Screen
  const gaugeWrap = document.getElementById('dash-ring-gauge-wrap');
  if (gaugeWrap) {
    topGaugeInstance = new RingGauge(gaugeWrap, { title: 'NETWORK SHARE' });
  }

  // --- BOTTOM SCREEN ZONE ---
  const bottomContent = el('div', { class: 'dashboard-bottom-content' }, [
    el('div', { class: 'dashboard-main-grid-wrap' }, [
      el('div', { class: 'dashboard-main-grid', id: 'dash-main-cards-grid' }),
      el('div', { class: 'dashboard-quick-stats', id: 'dash-quick-stats' }, [
        renderStatTile('PEAK ZONE LOAD', '—', 'TOP ACTIVE TARGET'),
        renderStatTile('ENTERPRISE TIER', '—', 'MISSION CRITICAL'),
        renderStatTile('AVG ZONE VOLUME', '—', 'REQUESTS / MIN'),
        renderStatTile('NETWORK HEALTH', '100.0%', 'EDGE NOMINAL')
      ])
    ]),
    // Bottom Pagination Bar
    el('div', { class: 'dashboard-pagination', id: 'dash-pagination' }, [
      el('div', { class: 'pagination-controls' }, [
        el('button', { class: 'pagination-btn', id: 'page-prev-btn', textContent: '◄ PREV' }),
        el('span', { class: 'pagination-page-info', id: 'page-info-text', textContent: 'PAGE 1 / 1' }),
        el('button', { class: 'pagination-btn', id: 'page-next-btn', textContent: 'NEXT ►' })
      ]),
      el('div', { class: 'pagination-cycle-bar' }, [
        el('span', { class: 'cycle-label', textContent: 'AUTO-CYCLE 30S' }),
        el('div', { class: 'cycle-track' }, [
          el('div', { class: 'cycle-fill', id: 'cycle-progress-fill' })
        ])
      ])
    ])
  ]);
  bottomScreen.appendChild(bottomContent);

  // Wire pagination buttons
  const prevBtn = document.getElementById('page-prev-btn');
  const nextBtn = document.getElementById('page-next-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      resetCycleTimer();
      navigatePage(-1);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      resetCycleTimer();
      navigatePage(1);
    });
  }
}

/**
 * Fetch zones and their analytics concurrently, filter traffic, and update view
 * @param {boolean} isInitial
 */
async function loadDashboardData(isInitial = false) {
  try {
    const zonesRes = await api.getZones(abortCtrl?.signal);
    const zones = zonesRes?.zones || [];

    // Consider only active zones
    const activeZones = zones.filter(z => z.status === 'active');

    // Fetch analytics in parallel with concurrency limit (6)
    const analyticsResults = await mapConcurrentSettled(
      activeZones,
      async (zone) => {
        const analytics = await api.getZoneAnalytics(zone.id, abortCtrl?.signal);
        return {
          ...zone,
          ...analytics,
          zone_id: zone.id,
          zone_name: zone.name,
          plan: zone.plan || analytics.plan || 'free'
        };
      },
      CONFIG.CONCURRENCY_LIMIT
    );

    // Keep only zones with actual traffic (> 0 total requests) and successful fetch
    const validWithTraffic = [];
    for (const res of analyticsResults) {
      if (res.status === 'fulfilled' && res.value) {
        const val = res.value;
        const total = (val.data || []).reduce((sum, p) => sum + (Number(p.requests) || 0), 0);
        if (total > 0) {
          validWithTraffic.push({ ...val, total_requests: total });
        }
      }
    }

    // Sort by total requests descending
    validWithTraffic.sort((a, b) => b.total_requests - a.total_requests);
    activeZonesWithTraffic = validWithTraffic;

    // Update KPIs & derived widgets
    updateDashboardKpis(activeZonesWithTraffic, activeZones.length);

    // Update Top Screen Ring Gauge and Velocity List
    updateTopVisualizations(activeZonesWithTraffic);

    // Render / update Zone Cards in place
    renderOrUpdateZoneCards();

    // Set updated time in header
    setHeaderUpdatedTime(zonesRes.server_time || new Date());

    // Dismiss splash screen on initial success
    if (isInitial) {
      dismissSplash();
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('Dashboard data fetch error:', err);

    if (isInitial) {
      dismissSplash();
      const topScreen = document.getElementById('dash-top-zone');
      if (topScreen) {
        clearChildren(topScreen);
        topScreen.appendChild(renderEmptyState({
          title: 'API CONNECTION FAILED',
          desc: err.detail || 'Failed to establish connection to Cloudflare monitoring backend. Verify authentication and network.',
          actionLabel: 'RETRY CONNECTION',
          onAction: () => loadDashboardData(true)
        }));
      }
    }
  }
}

/**
 * Update Top Screen KPI Tiles
 */
function updateDashboardKpis(zones, totalActiveCount) {
  const kpiStrip = document.getElementById('dash-kpi-strip');
  if (!kpiStrip) return;

  const totalReqs = zones.reduce((sum, z) => sum + z.total_requests, 0);

  // Top growing and declining
  const sortedByChange = [...zones].sort((a, b) => (Number(b.percent_change) || 0) - (Number(a.percent_change) || 0));
  const topGrowing = sortedByChange[0];
  const topDeclining = sortedByChange[sortedByChange.length - 1];

  clearChildren(kpiStrip);
  kpiStrip.appendChild(renderKpiSkeleton('ACTIVE ZONES', `${zones.length} / ${totalActiveCount}`, 'WITH LIVE TRAFFIC', 'amber'));
  kpiStrip.appendChild(renderKpiSkeleton('TOTAL REQUESTS', formatCompact(totalReqs), 'SUM ACROSS ACTIVE', 'orange'));
  kpiStrip.appendChild(renderKpiSkeleton(
    'TOP GROWTH', 
    topGrowing ? formatPercent(topGrowing.percent_change) : '—', 
    topGrowing ? topGrowing.zone_name : 'NO DATA', 
    'green'
  ));
  kpiStrip.appendChild(renderKpiSkeleton(
    'TOP DECLINE', 
    topDeclining && Number(topDeclining.percent_change) < 0 ? formatPercent(topDeclining.percent_change) : '—', 
    topDeclining && Number(topDeclining.percent_change) < 0 ? topDeclining.zone_name : 'STABLE', 
    'blue'
  ));

  // Quick stat column on bottom right
  const quickStats = document.getElementById('dash-quick-stats');
  if (quickStats) {
    const entCount = zones.filter(z => (z.plan || '').toLowerCase() === 'enterprise').length;
    const avgLoad = zones.length > 0 ? Math.round(totalReqs / zones.length / 30) : 0;
    const peakZone = zones[0];

    clearChildren(quickStats);
    quickStats.appendChild(renderStatTile('PEAK ZONE LOAD', peakZone ? formatCompact(peakZone.total_requests) : '0', peakZone ? peakZone.zone_name : 'NONE'));
    quickStats.appendChild(renderStatTile('ENTERPRISE TIER', `${entCount} ZONES`, 'HIGH PRIORITY SLA'));
    quickStats.appendChild(renderStatTile('AVG ZONE VOLUME', `${formatCompact(avgLoad)}/MIN`, 'PER ACTIVE DOMAIN'));
    quickStats.appendChild(renderStatTile('NETWORK HEALTH', '100.0%', 'EDGE NOMINAL'));
  }
}

/**
 * Update Top Visualizations (Ring Gauge & Top 4 Velocity list)
 */
function updateTopVisualizations(zones) {
  const totalReqs = zones.reduce((sum, z) => sum + z.total_requests, 0);

  if (topGaugeInstance) {
    topGaugeInstance.update(zones, totalReqs);
  }

  const velocityList = document.getElementById('dash-velocity-list');
  if (velocityList) {
    clearChildren(velocityList);
    const top4 = zones.slice(0, 4);

    top4.forEach((z, idx) => {
      const row = el('div', { class: 'gauge-legend-row', style: 'padding: 3px 0;' }, [
        el('div', { style: 'display: flex; align-items: center; gap: 6px;' }, [
          el('span', { class: 'micro-label', textContent: `0${idx + 1}` }),
          el('span', { class: 'gauge-legend-name', textContent: z.zone_name })
        ]),
        el('div', { style: 'display: flex; align-items: center; gap: 6px;' }, [
          el('span', { class: `badge badge--plan-${(z.plan || 'free').toLowerCase()}`, textContent: (z.plan || 'FREE').slice(0, 3).toUpperCase() }),
          el('span', { class: 'gauge-legend-pct', textContent: formatCompact(z.total_requests) })
        ])
      ]);
      velocityList.appendChild(row);
    });

    if (top4.length === 0) {
      velocityList.appendChild(el('span', { class: 'micro-label', textContent: 'NO ACTIVE ZONES' }));
    }
  }
}

/**
 * Render or in-place update zone cards across top tier & main grid
 */
function renderOrUpdateZoneCards() {
  const topTierWrap = document.getElementById('dash-top-tier-cards');
  const mainGridWrap = document.getElementById('dash-main-cards-grid');
  if (!topTierWrap || !mainGridWrap) return;

  // Top tier shows top 3 zones
  const topTierZones = activeZonesWithTraffic.slice(0, CONFIG.TOP_TIER_CARD_COUNT);

  // Main grid shows remaining zones paginated by DASHBOARD_PAGE_SIZE (8 cards: 4x2)
  const remainingZones = activeZonesWithTraffic.slice(CONFIG.TOP_TIER_CARD_COUNT);
  const totalPages = Math.max(1, Math.ceil(remainingZones.length / CONFIG.DASHBOARD_PAGE_SIZE));

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  const pageStartIndex = (currentPage - 1) * CONFIG.DASHBOARD_PAGE_SIZE;
  const pageZones = remainingZones.slice(pageStartIndex, pageStartIndex + CONFIG.DASHBOARD_PAGE_SIZE);

  // Update Top Tier Cards in place
  updateCardContainer(topTierWrap, topTierZones);

  // Update Main Grid Cards in place
  updateCardContainer(mainGridWrap, pageZones);

  // Update pagination info
  const pageInfo = document.getElementById('page-info-text');
  const prevBtn = document.getElementById('page-prev-btn');
  const nextBtn = document.getElementById('page-next-btn');

  if (pageInfo) {
    pageInfo.textContent = `PAGE ${currentPage} / ${totalPages}`;
  }
  if (prevBtn) prevBtn.disabled = totalPages <= 1;
  if (nextBtn) nextBtn.disabled = totalPages <= 1;
}

/**
 * In-place update helper for card containers
 */
function updateCardContainer(container, targetZones) {
  const targetIds = new Set(targetZones.map(z => z.zone_id));

  // Remove cards that are no longer visible in this container
  const currentCardEls = Array.from(container.children);
  for (const child of currentCardEls) {
    const zoneId = child.getAttribute('data-zone-id');
    if (!targetIds.has(zoneId)) {
      const inst = cardInstancesMap.get(zoneId);
      if (inst) {
        inst.destroy();
        cardInstancesMap.delete(zoneId);
      }
      container.removeChild(child);
    }
  }

  // Update existing or append new cards
  targetZones.forEach((z) => {
    let cardInst = cardInstancesMap.get(z.zone_id);
    if (cardInst && cardInst.element.parentElement === container) {
      cardInst.update(z);
    } else {
      if (cardInst) {
        cardInst.destroy();
        cardInstancesMap.delete(z.zone_id);
      }
      cardInst = new ZoneCard(z);
      cardInstancesMap.set(z.zone_id, cardInst);
      container.appendChild(cardInst.element);
    }
  });

  if (targetZones.length === 0 && container.children.length === 0) {
    container.appendChild(el('div', { class: 'empty-state', style: 'padding: 16px; margin: auto; grid-column: 1 / -1;' }, [
      el('span', { class: 'micro-label', textContent: 'NO ADDITIONAL ZONES WITH TRAFFIC' })
    ]));
  }
}

/**
 * Navigate to next/prev page
 */
function navigatePage(delta) {
  const remainingZones = activeZonesWithTraffic.slice(CONFIG.TOP_TIER_CARD_COUNT);
  const totalPages = Math.max(1, Math.ceil(remainingZones.length / CONFIG.DASHBOARD_PAGE_SIZE));

  if (totalPages <= 1) return;

  currentPage += delta;
  if (currentPage > totalPages) currentPage = 1;
  if (currentPage < 1) currentPage = totalPages;

  renderOrUpdateZoneCards();
}

/**
 * Auto-cycle timer with progress bar
 */
function startAutoCycle() {
  cycleStartTime = Date.now();

  if (cycleProgressTimer) clearInterval(cycleProgressTimer);
  cycleProgressTimer = setInterval(() => {
    const elapsed = Date.now() - cycleStartTime;
    const pct = Math.min(100, (elapsed / CONFIG.DASHBOARD_CYCLE_MS) * 100);
    const fill = document.getElementById('cycle-progress-fill');
    if (fill) fill.style.width = `${pct}%`;
  }, 100);

  if (cycleTimer) clearInterval(cycleTimer);
  cycleTimer = setInterval(() => {
    if (!document.hidden) {
      resetCycleTimer();
      navigatePage(1);
    }
  }, CONFIG.DASHBOARD_CYCLE_MS);
}

function resetCycleTimer() {
  cycleStartTime = Date.now();
  const fill = document.getElementById('cycle-progress-fill');
  if (fill) fill.style.width = '0%';
}

/**
 * Helper to render KPI skeleton tile
 */
function renderKpiSkeleton(label, val, sub, variant) {
  return el('div', { class: `kpi-tile kpi-tile--${variant}` }, [
    el('span', { class: 'kpi-label', textContent: label }),
    el('div', { class: 'kpi-value-row' }, [
      el('span', { class: `kpi-value ${variant === 'amber' ? 'kpi-value--amber' : ''}`, textContent: val }),
      el('span', { class: 'kpi-subtext', textContent: sub })
    ])
  ]);
}

/**
 * Helper to render stat tile for right-side column
 */
function renderStatTile(title, val, sub) {
  return el('div', { class: 'stat-tile' }, [
    el('span', { class: 'stat-tile-title', textContent: title }),
    el('span', { class: 'stat-tile-val stat-tile-val--amber', textContent: val }),
    el('span', { class: 'stat-tile-sub', textContent: sub })
  ]);
}
