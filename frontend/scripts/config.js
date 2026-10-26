/**
 * Application Constants & Configuration
 */
export const CONFIG = {
  // Polling intervals
  REFRESH_INTERVAL_MS: 60000,    // 60 seconds auto-refresh
  DASHBOARD_CYCLE_MS: 30000,     // 30 seconds page cycle
  CLOCK_TICK_MS: 1000,           // 1 second clock update

  // Dashboard layout limits
  DASHBOARD_PAGE_SIZE: 8,        // 8 cards in main grid (4x2)
  TOP_TIER_CARD_COUNT: 3,        // 3 cards in top section grid
  CONCURRENCY_LIMIT: 6,          // Parallel zone analytics limit

  // Telemetry limits
  TOP_PATHS_COUNT: 10,
  TOP_IPS_COUNT: 10,
  MAX_SUBDOMAINS: 6,
  MAX_SECONDARY_DOMAINS: 2,

  // Storage keys
  STORAGE_SPLASH_SHOWN: 'cf_splash_shown',
  STORAGE_SEAM_DEBUG: 'cf_seam_debug_active'
};
