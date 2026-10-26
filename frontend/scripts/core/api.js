/**
 * Core API Client & HTTP Transport
 * Enforces timeouts, 401 login redirects, JSON parsing, and typed error handling.
 */

export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {string} detail
   * @param {any} [raw]
   */
  constructor(status, detail, raw = null) {
    super(detail || `API Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail || 'Unknown server error';
    this.raw = raw;
  }
}

/**
 * Universal JSON fetch helper
 * @param {string} endpoint
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function request(endpoint, options = {}) {
  const timeoutMs = options.timeout || 12000;
  const controller = new AbortController();
  const callerSignal = options.signal;

  // Chain external signal if provided
  if (callerSignal) {
    if (callerSignal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    callerSignal.addEventListener('abort', () => controller.abort());
  }

  const timer = setTimeout(() => {
    controller.abort(new Error('Request timeout'));
  }, timeoutMs);

  try {
    const headers = {
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const res = await fetch(endpoint, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timer);

    // Unauthenticated handling -> redirect to login
    if (res.status === 401) {
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
      throw new ApiError(401, 'Unauthorized');
    }

    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => null);
    }

    if (!res.ok) {
      const detail = data?.detail || `Server error (${res.status})`;
      throw new ApiError(res.status, detail, data);
    }

    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof ApiError) throw err;
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, err.message || 'Network connection failed');
  }
}

export const api = {
  // Auth endpoints
  async login(username, password) {
    return request('/api/auth/login', {
      method: 'POST',
      body: { username, password }
    });
  },

  async logout() {
    return request('/api/auth/logout', {
      method: 'POST'
    });
  },

  // Zones endpoints
  async getZones(signal) {
    return request('/api/zones', { signal });
  },

  async getZoneAnalytics(zoneId, signal) {
    return request(`/api/zones/${encodeURIComponent(zoneId)}/analytics`, { signal });
  },

  // Subdomains endpoint
  async getSubdomainOverview(signal) {
    return request('/api/subdomain/overview', { signal });
  },

  // Settings endpoints
  async getSettings(signal) {
    return request('/api/settings', { signal });
  },

  async updateSettings(payload) {
    return request('/api/settings', {
      method: 'PUT',
      body: payload
    });
  }
};
