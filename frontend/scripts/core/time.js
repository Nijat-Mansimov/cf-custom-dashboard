/**
 * Time Parsing & Formatting Utilities
 * Backend timestamps without 'Z' or offset are treated as UTC.
 * Local browser time is formatted in 24h format.
 */

/**
 * Parse timestamp safely, treating offset-less strings as UTC
 * @param {string|Date|number|null} raw
 * @returns {Date}
 */
export function parseDate(raw) {
  if (!raw) return new Date();
  if (raw instanceof Date) return raw;
  if (typeof raw === 'number') return new Date(raw);

  let str = String(raw).trim();
  // If string has ISO format without Z or timezone offset (+/-), treat as UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) {
    str += 'Z';
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Format local time as HH:MM:SS (24-hour)
 * @param {Date|string|number} [date]
 * @returns {string}
 */
export function formatTimeSec(date = new Date()) {
  const d = parseDate(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Format local time as HH:MM (24-hour)
 * @param {Date|string|number} [date]
 * @returns {string}
 */
export function formatTimeMin(date = new Date()) {
  const d = parseDate(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
