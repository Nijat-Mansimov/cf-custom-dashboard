/**
 * Settings Page Module
 * Manages API token storage, dynamic subdomains (1-6) with parent domain validation,
 * secondary domains (1-2), dirty tracking, Ctrl+S saving, and auto-save on navigation.
 */
import { api, ApiError } from '../core/api.js';
import { el, clearChildren } from '../core/dom.js';
import { showToast } from '../components/toast.js';
import { CONFIG } from '../config.js';

let abortCtrl = null;
let isDirty = false;
let hasExistingToken = false;
let tokenEdited = false;
let clearTokenRequested = false;

// Form state
let subdomainsList = [''];
let secondaryList = [''];

export async function mount(container) {
  abortCtrl = new AbortController();
  clearChildren(container);
  isDirty = false;
  tokenEdited = false;
  clearTokenRequested = false;

  const contentWrap = el('div', { class: 'settings-content-wrap' });
  container.appendChild(contentWrap);

  renderSettingsFormSkeleton(contentWrap);
  await loadSettingsData(contentWrap);

  // Setup keyboard shortcut: Ctrl/Cmd + S to save
  window.addEventListener('keydown', handleKeySave);
}

export function unmount() {
  if (abortCtrl) {
    abortCtrl.abort();
    abortCtrl = null;
  }
  window.removeEventListener('keydown', handleKeySave);
}

/**
 * Hook checked by router before navigating away
 * If dirty, auto-saves before navigation proceeds.
 */
export async function autoSaveIfDirty() {
  if (!isDirty) return true;
  try {
    const success = await saveSettings(false);
    return success;
  } catch (err) {
    console.error('Auto-save error before navigation:', err);
    return true; // Still allow navigation if auto-save fails
  }
}

function handleKeySave(e) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    saveSettings(true);
  }
}

/**
 * Render initial settings skeleton
 */
function renderSettingsFormSkeleton(container) {
  container.innerHTML = `
    <div id="settings-banner-slot"></div>

    <!-- API Token Card -->
    <div class="settings-section-card">
      <div class="settings-card-head">
        <div>
          <h2 class="settings-card-title">
            <i data-lucide="key" style="width: 16px; height: 16px; color: var(--accent-amber);"></i>
            <span>CLOUDFLARE API CREDENTIALS</span>
          </h2>
          <p class="settings-card-desc">Token requires Zone.Analytics:Read permissions</p>
        </div>
        <div id="token-status-slot"></div>
      </div>

      <div class="form-group">
        <label class="form-label" for="api-token-input">
          <span>API Token</span>
          <span class="micro-label" id="token-action-lbl"></span>
        </label>
        <div class="form-input-wrap">
          <input type="password" id="api-token-input" class="form-input" autocomplete="off" spellcheck="false" placeholder="Enter Cloudflare API token..." />
        </div>
        <p class="form-hint">Stored securely on server — leave blank to keep existing token.</p>
        <div id="token-remove-confirm-slot"></div>
      </div>
    </div>

    <!-- Primary Zone Subdomains Card -->
    <div class="settings-section-card">
      <div class="settings-card-head">
        <div>
          <h2 class="settings-card-title">
            <i data-lucide="globe" style="width: 16px; height: 16px; color: var(--accent-amber);"></i>
            <span>PRIMARY ZONE SUBDOMAINS</span>
          </h2>
          <p class="settings-card-desc">1 to 6 subdomains. All entries must share the identical parent domain.</p>
        </div>
        <span class="badge badge--plan-enterprise" id="subdomains-count-badge">0 / 6</span>
      </div>

      <div id="subdomains-input-list"></div>
      <div id="subdomains-error-slot"></div>

      <button type="button" class="btn btn-outline" id="add-subdomain-btn" style="margin-top: 10px;">
        <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
        <span>ADD SUBDOMAIN</span>
      </button>
    </div>

    <!-- Secondary Domains Card -->
    <div class="settings-section-card">
      <div class="settings-card-head">
        <div>
          <h2 class="settings-card-title">
            <i data-lucide="network" style="width: 16px; height: 16px; color: var(--accent-amber);"></i>
            <span>SECONDARY DOMAINS</span>
          </h2>
          <p class="settings-card-desc">0 to 2 secondary zones for top subdomain and path tracking.</p>
        </div>
        <span class="badge badge--plan-pro" id="secondary-count-badge">0 / 2</span>
      </div>

      <div id="secondary-input-list"></div>
      <div id="secondary-error-slot"></div>

      <button type="button" class="btn btn-outline" id="add-secondary-btn" style="margin-top: 10px;">
        <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
        <span>ADD SECONDARY DOMAIN</span>
      </button>
    </div>

    <!-- Sticky Save Bar -->
    <div class="settings-save-bar">
      <div class="save-status-info">
        <span class="save-status-badge" id="dirty-status-badge">CLEAN</span>
        <span id="save-msg-text">Press Ctrl+S or click to save changes</span>
      </div>
      <button type="button" class="btn btn-amber btn-pill" id="save-settings-btn">
        <i data-lucide="check" style="width: 14px; height: 14px;"></i>
        <span>SAVE CONFIGURATION</span>
      </button>
    </div>
  `;

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }
}

/**
 * Fetch settings and bind form controls
 */
async function loadSettingsData(container) {
  try {
    const data = await api.getSettings(abortCtrl?.signal);

    hasExistingToken = Boolean(data.has_api_token);
    subdomainsList = Array.isArray(data.subdomains) && data.subdomains.length > 0 ? [...data.subdomains] : [''];
    secondaryList = Array.isArray(data.secondary_domains) ? [...data.secondary_domains] : [];

    // First run banner if no token and no domains
    const bannerSlot = document.getElementById('settings-banner-slot');
    if (bannerSlot && !hasExistingToken && subdomainsList.filter(Boolean).length === 0) {
      bannerSlot.appendChild(el('div', { class: 'first-run-banner' }, [
        el('div', { class: 'first-run-text' }, [
          el('i', { 'data-lucide': 'alert-triangle', style: 'width: 16px; height: 16px;' }),
          el('span', { textContent: 'CONFIGURE YOUR MONITOR — Add your Cloudflare API token and zones to begin.' })
        ])
      ]));
    }

    renderTokenControls();
    renderSubdomainInputs();
    renderSecondaryInputs();
    wireEventListeners();
  } catch (err) {
    if (err.name === 'AbortError') return;
    showToast(err.detail || 'Failed to load settings', 'error');
  }
}

function renderTokenControls() {
  const statusSlot = document.getElementById('token-status-slot');
  const tokenInput = document.getElementById('api-token-input');
  const actionLbl = document.getElementById('token-action-lbl');

  if (statusSlot) {
    clearChildren(statusSlot);
    statusSlot.appendChild(el('span', {
      class: `token-status-pill ${hasExistingToken ? 'token-status-pill--active' : 'token-status-pill--empty'}`,
      textContent: hasExistingToken ? '● ACTIVE TOKEN CONFIGURED' : '○ NO TOKEN CONFIGURED'
    }));
  }

  if (tokenInput) {
    if (hasExistingToken) {
      tokenInput.placeholder = '••••••••••••••••••••••••••••••••';
    } else {
      tokenInput.placeholder = 'Enter Cloudflare API token...';
    }
  }

  if (actionLbl && hasExistingToken) {
    clearChildren(actionLbl);
    const removeLink = el('button', {
      type: 'button',
      class: 'btn-danger',
      style: 'padding: 2px 8px; font-size: 10px; border-radius: 4px;',
      textContent: 'REMOVE TOKEN',
      onClick: showTokenRemovalConfirm
    });
    actionLbl.appendChild(removeLink);
  }
}

function showTokenRemovalConfirm() {
  const confirmSlot = document.getElementById('token-remove-confirm-slot');
  if (!confirmSlot) return;
  clearChildren(confirmSlot);

  const box = el('div', { class: 'token-remove-confirm' }, [
    el('span', { textContent: 'Are you sure you want to clear the stored API token?' }),
    el('div', { style: 'display: flex; gap: 6px;' }, [
      el('button', {
        type: 'button',
        class: 'btn btn-danger',
        style: 'padding: 3px 8px; font-size: 10px;',
        textContent: 'CONFIRM CLEAR',
        onClick: () => {
          clearTokenRequested = true;
          hasExistingToken = false;
          tokenEdited = false;
          const input = document.getElementById('api-token-input');
          if (input) {
            input.value = '';
            input.placeholder = 'Token will be removed on save';
          }
          clearChildren(confirmSlot);
          markDirty();
          renderTokenControls();
          showToast('Token removal marked. Click Save to persist.', 'info');
        }
      }),
      el('button', {
        type: 'button',
        class: 'btn btn-outline',
        style: 'padding: 3px 8px; font-size: 10px;',
        textContent: 'CANCEL',
        onClick: () => clearChildren(confirmSlot)
      })
    ])
  ]);

  confirmSlot.appendChild(box);
}

function renderSubdomainInputs() {
  const list = document.getElementById('subdomains-input-list');
  const countBadge = document.getElementById('subdomains-count-badge');
  const addBtn = document.getElementById('add-subdomain-btn');
  if (!list) return;

  clearChildren(list);
  if (countBadge) countBadge.textContent = `${subdomainsList.length} / ${CONFIG.MAX_SUBDOMAINS}`;
  if (addBtn) addBtn.style.display = subdomainsList.length >= CONFIG.MAX_SUBDOMAINS ? 'none' : 'inline-flex';

  subdomainsList.forEach((subVal, idx) => {
    const input = el('input', {
      type: 'text',
      class: 'form-input',
      placeholder: 'e.g. api.kapitalbank.az',
      value: subVal,
      spellcheck: 'false',
      onInput: (e) => {
        subdomainsList[idx] = e.target.value;
        markDirty();
      }
    });

    const rowChildren = [input];
    if (subdomainsList.length > 1) {
      rowChildren.push(el('button', {
        type: 'button',
        class: 'dynamic-row-action',
        title: 'Remove subdomain',
        onClick: () => {
          subdomainsList.splice(idx, 1);
          markDirty();
          renderSubdomainInputs();
        }
      }, [
        el('i', { 'data-lucide': 'trash-2', style: 'width: 14px; height: 14px;' })
      ]));
    }

    list.appendChild(el('div', { class: 'dynamic-row' }, rowChildren));
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: list });
  }
}

function renderSecondaryInputs() {
  const list = document.getElementById('secondary-input-list');
  const countBadge = document.getElementById('secondary-count-badge');
  const addBtn = document.getElementById('add-secondary-btn');
  if (!list) return;

  clearChildren(list);
  if (countBadge) countBadge.textContent = `${secondaryList.length} / ${CONFIG.MAX_SECONDARY_DOMAINS}`;
  if (addBtn) addBtn.style.display = secondaryList.length >= CONFIG.MAX_SECONDARY_DOMAINS ? 'none' : 'inline-flex';

  secondaryList.forEach((secVal, idx) => {
    const input = el('input', {
      type: 'text',
      class: 'form-input',
      placeholder: 'e.g. birbank.az',
      value: secVal,
      spellcheck: 'false',
      onInput: (e) => {
        secondaryList[idx] = e.target.value;
        markDirty();
      }
    });

    list.appendChild(el('div', { class: 'dynamic-row' }, [
      input,
      el('button', {
        type: 'button',
        class: 'dynamic-row-action',
        title: 'Remove secondary domain',
        onClick: () => {
          secondaryList.splice(idx, 1);
          markDirty();
          renderSecondaryInputs();
        }
      }, [
        el('i', { 'data-lucide': 'trash-2', style: 'width: 14px; height: 14px;' })
      ])
    ]));
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: list });
  }
}

function wireEventListeners() {
  const tokenInput = document.getElementById('api-token-input');
  if (tokenInput) {
    tokenInput.addEventListener('input', () => {
      tokenEdited = true;
      clearTokenRequested = false;
      markDirty();
    });
    // First keystroke clears placeholder mask
    tokenInput.addEventListener('focus', () => {
      if (hasExistingToken && !tokenEdited) {
        tokenInput.placeholder = 'Enter new token to replace existing...';
      }
    });
  }

  const addSubBtn = document.getElementById('add-subdomain-btn');
  if (addSubBtn) {
    addSubBtn.addEventListener('click', () => {
      if (subdomainsList.length < CONFIG.MAX_SUBDOMAINS) {
        subdomainsList.push('');
        markDirty();
        renderSubdomainInputs();
      }
    });
  }

  const addSecBtn = document.getElementById('add-secondary-btn');
  if (addSecBtn) {
    addSecBtn.addEventListener('click', () => {
      if (secondaryList.length < CONFIG.MAX_SECONDARY_DOMAINS) {
        secondaryList.push('');
        markDirty();
        renderSecondaryInputs();
      }
    });
  }

  const saveBtn = document.getElementById('save-settings-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => saveSettings(true));
  }
}

function markDirty() {
  isDirty = true;
  const badge = document.getElementById('dirty-status-badge');
  if (badge) {
    badge.className = 'save-status-badge save-status-badge--dirty';
    badge.textContent = 'UNSAVED CHANGES';
  }
}

function markSaved() {
  isDirty = false;
  const badge = document.getElementById('dirty-status-badge');
  if (badge) {
    badge.className = 'save-status-badge save-status-badge--success';
    badge.textContent = 'SAVED ✓';
    setTimeout(() => {
      if (!isDirty && badge) {
        badge.className = 'save-status-badge';
        badge.textContent = 'ALL SAVED';
      }
    }, 2500);
  }
}

/**
 * Helper: extract parent domain (last two labels e.g. kapitalbank.az)
 * @param {string} hostname
 * @returns {string}
 */
function getParentDomain(hostname) {
  const parts = hostname.toLowerCase().split('.').filter(Boolean);
  if (parts.length < 2) return hostname;
  return parts.slice(-2).join('.');
}

/**
 * Validate and save settings
 * @param {boolean} showToasts
 * @returns {Promise<boolean>}
 */
async function saveSettings(showToasts = true) {
  const subErrSlot = document.getElementById('subdomains-error-slot');
  const secErrSlot = document.getElementById('secondary-error-slot');
  if (subErrSlot) clearChildren(subErrSlot);
  if (secErrSlot) clearChildren(secErrSlot);

  // Clean subdomains: trim, lowercase, remove empties
  const cleanSubs = subdomainsList.map(s => s.trim().toLowerCase()).filter(Boolean);
  const cleanSecs = secondaryList.map(s => s.trim().toLowerCase()).filter(Boolean);

  // Validate subdomains count
  if (cleanSubs.length === 0) {
    if (subErrSlot) {
      subErrSlot.appendChild(el('p', { class: 'form-error-msg', textContent: 'At least one primary subdomain is required.' }));
    }
    if (showToasts) showToast('At least one subdomain is required', 'error');
    return false;
  }

  if (cleanSubs.length > CONFIG.MAX_SUBDOMAINS) {
    if (subErrSlot) {
      subErrSlot.appendChild(el('p', { class: 'form-error-msg', textContent: `Max ${CONFIG.MAX_SUBDOMAINS} subdomains allowed.` }));
    }
    return false;
  }

  // Check duplicates in subdomains
  const subSet = new Set(cleanSubs);
  if (subSet.size !== cleanSubs.length) {
    if (subErrSlot) {
      subErrSlot.appendChild(el('p', { class: 'form-error-msg', textContent: 'Duplicate subdomains are not permitted.' }));
    }
    return false;
  }

  // Crucial check: All primary subdomains must share identical parent domain
  const parentDomains = cleanSubs.map(getParentDomain);
  const uniqueParents = new Set(parentDomains);
  if (uniqueParents.size > 1) {
    if (subErrSlot) {
      subErrSlot.appendChild(el('p', { 
        class: 'form-error-msg', 
        textContent: `All primary subdomains must belong to the same parent domain. Found conflicting: ${Array.from(uniqueParents).join(', ')}` 
      }));
    }
    if (showToasts) showToast('Primary subdomains must share parent domain', 'error');
    return false;
  }

  // Validate secondary domains
  if (cleanSecs.length > CONFIG.MAX_SECONDARY_DOMAINS) {
    if (secErrSlot) {
      secErrSlot.appendChild(el('p', { class: 'form-error-msg', textContent: `Max ${CONFIG.MAX_SECONDARY_DOMAINS} secondary domains allowed.` }));
    }
    return false;
  }

  const secSet = new Set(cleanSecs);
  if (secSet.size !== cleanSecs.length) {
    if (secErrSlot) {
      secErrSlot.appendChild(el('p', { class: 'form-error-msg', textContent: 'Duplicate secondary domains are not permitted.' }));
    }
    return false;
  }

  // Construct payload
  const payload = {
    subdomains: cleanSubs,
    secondary_domains: cleanSecs
  };

  const tokenInput = document.getElementById('api-token-input');
  if (clearTokenRequested) {
    payload.clear_api_token = true;
  } else if (tokenEdited && tokenInput && tokenInput.value.trim()) {
    payload.api_token = tokenInput.value.trim();
  }

  const saveBtn = document.getElementById('save-settings-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="tab-loader-spinner" style="width: 14px; height: 14px; border-width: 1.5px;"></span><span>SAVING...</span>';
  }

  try {
    const updated = await api.updateSettings(payload);
    hasExistingToken = Boolean(updated.has_api_token);
    subdomainsList = [...updated.subdomains];
    secondaryList = [...updated.secondary_domains];
    tokenEdited = false;
    clearTokenRequested = false;

    if (tokenInput && payload.api_token) {
      tokenInput.value = '';
    }

    renderTokenControls();
    renderSubdomainInputs();
    renderSecondaryInputs();
    markSaved();

    if (showToasts) {
      showToast('Configuration saved successfully', 'success');
    }
    return true;
  } catch (err) {
    console.error('Settings save failed:', err);
    const detail = err.detail || 'ERROR — TRY AGAIN';
    if (showToasts) {
      showToast(detail, 'error');
    }
    const badge = document.getElementById('dirty-status-badge');
    if (badge) {
      badge.className = 'save-status-badge save-status-badge--error';
      badge.textContent = 'SAVE FAILED';
    }
    return false;
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px;"></i><span>SAVE CONFIGURATION</span>';
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: saveBtn });
      }
    }
  }
}
