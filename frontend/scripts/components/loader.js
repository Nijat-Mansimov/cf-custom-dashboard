/**
 * Tab Transition Loader Helper
 */
export function showTabLoader() {
  const el = document.getElementById('tab-loader');
  if (el) el.classList.add('is-active');
}

export function hideTabLoader() {
  const el = document.getElementById('tab-loader');
  if (el) el.classList.remove('is-active');
}
