/**
 * Shared Line Chart Factory (Chart.js Wrapper)
 * Reads design tokens dynamically from CSS custom properties.
 * Supports flicker-free in-place data updates and clean destruction.
 */
import { formatTimeMin } from '../core/time.js';
import { formatCompact, formatInt } from '../core/format.js';

/**
 * Read CSS custom property value
 * @param {string} varName
 * @param {string} fallback
 * @returns {string}
 */
function getCssToken(varName, fallback) {
  if (typeof window === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return val || fallback;
}

/**
 * Create a Chart.js line chart for telemetry series
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{ timestamp: string, requests: number }>} dataPoints
 * @param {object} [options]
 * @returns {any} Chart.js instance
 */
export function createTelemetryLineChart(canvas, dataPoints = [], options = {}) {
  if (!window.Chart) {
    console.warn('Chart.js vendor library not loaded');
    return null;
  }

  const orange = getCssToken('--accent-orange', '#FF8A1F');
  const amber = getCssToken('--accent-amber', '#FFC21A');
  const gridColor = 'rgba(255, 255, 255, 0.05)';
  const tickColor = getCssToken('--text-muted', '#6B7280');

  const labels = dataPoints.map(p => formatTimeMin(p.timestamp));
  const values = dataPoints.map(p => Number(p.requests) || 0);

  const ctx = canvas.getContext('2d');

  // Gradient fill under the curve
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 100);
  gradient.addColorStop(0, 'rgba(255, 138, 31, 0.22)');
  gradient.addColorStop(1, 'rgba(255, 138, 31, 0.00)');

  const chart = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: options.label || 'Requests',
          data: values,
          borderColor: orange,
          borderWidth: 1.8,
          backgroundColor: gradient,
          fill: true,
          tension: 0.25,
          pointRadius: values.length > 20 ? 0 : 2,
          pointHoverRadius: 4,
          pointBackgroundColor: amber,
          pointBorderColor: '#09090b',
          pointBorderWidth: 1.5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: options.animate !== false ? { duration: 400 } : false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#141418',
          titleColor: '#F3F4F6',
          bodyColor: amber,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 8,
          displayColors: false,
          titleFont: { family: "'IBM Plex Mono', monospace", size: 10 },
          bodyFont: { family: "'IBM Plex Mono', monospace", size: 12, weight: '700' },
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => `${formatInt(item.raw)} reqs`
          }
        }
      },
      scales: {
        x: {
          display: options.showAxes !== false,
          grid: { color: gridColor, drawBorder: false },
          ticks: {
            color: tickColor,
            font: { family: "'IBM Plex Mono', monospace", size: 9 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6
          }
        },
        y: {
          display: options.showAxes !== false,
          grid: { color: gridColor, drawBorder: false },
          ticks: {
            color: tickColor,
            font: { family: "'IBM Plex Mono', monospace", size: 9 },
            callback: (val) => formatCompact(val),
            maxTicksLimit: 4
          },
          beginAtZero: true
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      }
    }
  });

  return chart;
}

/**
 * Update chart data in place without re-rendering or flickering
 * @param {any} chart
 * @param {Array<{ timestamp: string, requests: number }>} dataPoints
 */
export function updateTelemetryLineChart(chart, dataPoints = []) {
  if (!chart || !chart.data) return;

  chart.data.labels = dataPoints.map(p => formatTimeMin(p.timestamp));
  chart.data.datasets[0].data = dataPoints.map(p => Number(p.requests) || 0);
  chart.update('none'); // In-place update with zero animation flicker
}
