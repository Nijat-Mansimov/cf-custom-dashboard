/**
 * Number & Metric Formatting Utilities
 */

/**
 * Format compact numbers: 1.2K, 3.4M, 1.8B
 * @param {number|string|null} val
 * @returns {string}
 */
export function formatCompact(val) {
  const n = Number(val);
  if (isNaN(n) || val === null || val === undefined) return '0';
  if (Math.abs(n) >= 1_000_000_000) {
    return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (Math.abs(n) >= 1_000_000) {
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (Math.abs(n) >= 1_000) {
    return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return n.toLocaleString();
}

/**
 * Format integer with thousands separators: 1,234,567
 * @param {number|string|null} val
 * @returns {string}
 */
export function formatInt(val) {
  const n = Number(val);
  if (isNaN(n) || val === null || val === undefined) return '0';
  return Math.round(n).toLocaleString('en-US');
}

/**
 * Format percentage change with explicit sign: +12.5% or -3.2%
 * @param {number|string|null} val
 * @returns {string}
 */
export function formatPercent(val) {
  const n = Number(val);
  if (isNaN(n) || val === null || val === undefined) return '0.0%';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}
