/**
 * DOM Helper Utilities with Strict Security
 * Zero raw innerHTML for untrusted API strings (hostnames, paths, IPs).
 */

/**
 * Create a DOM element with classes, attributes, and children
 * @param {string} tag
 * @param {Record<string, any>} [attrs]
 * @param {Array<HTMLElement|string|null>} [children]
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);

  for (const [key, val] of Object.entries(attrs)) {
    if (val === null || val === undefined || val === false) continue;

    if (key === 'className' || key === 'class') {
      element.className = val;
    } else if (key === 'textContent') {
      element.textContent = val;
    } else if (key.startsWith('on') && typeof val === 'function') {
      const eventName = key.slice(2).toLowerCase();
      element.addEventListener(eventName, val);
    } else if (key.startsWith('data-')) {
      element.setAttribute(key, val);
    } else {
      element.setAttribute(key, val);
    }
  }

  for (const child of children) {
    if (child === null || child === undefined) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      element.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }

  return element;
}

/**
 * Remove all children from a DOM element
 * @param {HTMLElement} parent
 */
export function clearChildren(parent) {
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
}

/**
 * Escape string for safe text insertion
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
