/**
 * Empty & Error State Renderer
 */
import { el } from '../core/dom.js';

/**
 * Render empty state card
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.desc
 * @param {string} [options.icon='alert-triangle']
 * @param {string} [options.actionLabel]
 * @param {() => void} [options.onAction]
 * @returns {HTMLElement}
 */
export function renderEmptyState({ title, desc, icon = 'alert-triangle', actionLabel, onAction }) {
  const actions = [];
  if (actionLabel && onAction) {
    actions.push(el('button', {
      class: 'btn btn-amber',
      textContent: actionLabel,
      onClick: onAction
    }));
  }

  const card = el('div', { class: 'empty-state' }, [
    el('i', { 'data-lucide': icon, class: 'empty-state-icon' }),
    el('h3', { class: 'empty-state-title', textContent: title }),
    el('p', { class: 'empty-state-desc', textContent: desc }),
    actions.length > 0 ? el('div', { class: 'empty-state-actions' }, actions) : null
  ]);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    requestAnimationFrame(() => window.lucide.createIcons({ root: card }));
  }

  return card;
}
