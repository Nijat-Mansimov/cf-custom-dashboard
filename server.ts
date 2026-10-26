import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory session store & persistent mock settings state
const sessions = new Set<string>(['mock-valid-session']);
let mockSettings = {
  has_api_token: true,
  subdomains: [
    'api.kapitalbank.az',
    'auth.kapitalbank.az',
    'online.kapitalbank.az',
    'mobile.kapitalbank.az',
    'pay.kapitalbank.az',
    'id.kapitalbank.az'
  ],
  secondary_domains: ['birbank.az', 'k-connect.az']
};

// Simple cookie parser helper
function parseCookies(req: express.Request): Record<string, string> {
  const list: Record<string, string> = {};
  const rc = req.headers.cookie;
  if (!rc) return list;
  rc.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURI(parts.join('='));
    }
  });
  return list;
}

// Check session
function isAuthenticated(req: express.Request): boolean {
  const cookies = parseCookies(req);
  const sessionToken = cookies['session_id'];
  // If no session_id is set yet in dev environment, allow first-time convenience or authenticated token
  return Boolean(sessionToken && sessions.has(sessionToken)) || cookies['session_id'] === 'soc-operator-token';
}

// Static mounts (matching FastAPI mount structure exactly)
app.use('/styles', express.static(path.join(__dirname, 'frontend/styles')));
app.use('/scripts', express.static(path.join(__dirname, 'frontend/scripts')));
app.use('/assets', express.static(path.join(__dirname, 'frontend/assets')));
app.use('/static', express.static(path.join(__dirname, 'frontend')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Auth Endpoints
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(401).json({ detail: 'Invalid username or password' });
  }

  // Grant session
  const token = 'soc-operator-token';
  sessions.add(token);
  res.setHeader('Set-Cookie', `session_id=${token}; Path=/; HttpOnly; SameSite=Lax`);
  return res.json({ ok: true });
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', 'session_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly');
  return res.json({ ok: true });
});

// Auth Gate Middleware for remaining API routes
app.use('/api/*', (req, res, next) => {
  // Allow login/logout without cookie; for others check session
  // In development preview, if cookie isn't set yet, auto-bootstrap or accept
  const cookies = parseCookies(req);
  if (!cookies['session_id']) {
    // Set cookie for dev environment convenience so demo works out of the box
    res.setHeader('Set-Cookie', 'session_id=soc-operator-token; Path=/; HttpOnly; SameSite=Lax');
  }
  next();
});

// Zones Endpoint
app.get('/api/zones', (_req, res) => {
  const now = new Date();
  const zones = [
    { id: 'z-kapitalbank', name: 'kapitalbank.az', status: 'active', plan: 'enterprise' },
    { id: 'z-birbank', name: 'birbank.az', status: 'active', plan: 'business' },
    { id: 'z-kconnect', name: 'k-connect.az', status: 'active', plan: 'business' },
    { id: 'z-azeriqaz', name: 'azeriqaz.az', status: 'active', plan: 'pro' },
    { id: 'z-bankpay', name: 'bankpay.az', status: 'active', plan: 'enterprise' },
    { id: 'z-paymesh', name: 'paymesh.io', status: 'active', plan: 'business' },
    { id: 'z-terminal', name: 'terminal-cloud.az', status: 'active', plan: 'pro' },
    { id: 'z-openbanking', name: 'openbanking.az', status: 'active', plan: 'enterprise' },
    { id: 'z-fintech-hub', name: 'fintech-hub.az', status: 'active', plan: 'business' },
    { id: 'z-secure-id', name: 'secure-id.az', status: 'active', plan: 'pro' },
    { id: 'z-card-gate', name: 'card-gate.az', status: 'active', plan: 'enterprise' },
    { id: 'z-loyalty', name: 'loyalty-rewards.az', status: 'active', plan: 'free' }
  ];

  res.json({
    zones,
    total: zones.length,
    server_time: now.toISOString()
  });
});

// Zone Analytics Endpoint
app.get('/api/zones/:zone_id/analytics', (req, res) => {
  const zoneId = req.params.zone_id;
  const now = Date.now();

  // Generate 30 minute points
  const data = [];
  const baseTraffic = zoneId.includes('kapital') ? 2200 : (zoneId.includes('bank') ? 1400 : 650);

  for (let i = 29; i >= 0; i--) {
    const timestamp = new Date(now - i * 60 * 1000).toISOString();
    // Realistic fluctuating traffic with spikes
    const jitter = Math.sin(i / 3) * 300 + Math.random() * 200;
    const requests = Math.max(10, Math.round(baseTraffic + jitter));
    data.push({ timestamp, requests });
  }

  const percent_change = zoneId.includes('kapital') ? 14.8 : (zoneId.includes('birbank') ? -3.4 : 8.2);

  res.json({
    zone_id: zoneId,
    zone_name: zoneId.replace('z-', '') + '.az',
    plan: zoneId.includes('kapital') || zoneId.includes('open') ? 'enterprise' : 'business',
    range: 'last_30_minutes',
    data,
    server_time: new Date().toISOString(),
    next_refresh_in_seconds: 48,
    cached: true,
    percent_change,
    previous_requests: Math.round(baseTraffic * 28)
  });
});

// Subdomain Overview Endpoint
app.get('/api/subdomain/overview', (_req, res) => {
  const now = Date.now();

  function makeSeries(base: number) {
    const pts = [];
    for (let i = 29; i >= 0; i--) {
      pts.push({
        timestamp: new Date(now - i * 60 * 1000).toISOString(),
        requests: Math.max(5, Math.round(base + Math.sin(i / 2) * (base * 0.25) + Math.random() * 20))
      });
    }
    return pts;
  }

  const subdomains = [
    { name: 'api.kapitalbank.az', total_requests: 142500, percent_change: 12.4, data: makeSeries(475) },
    { name: 'auth.kapitalbank.az', total_requests: 86400, percent_change: 4.8, data: makeSeries(288) },
    { name: 'online.kapitalbank.az', total_requests: 112000, percent_change: -2.1, data: makeSeries(373) },
    { name: 'mobile.kapitalbank.az', total_requests: 98700, percent_change: 8.6, data: makeSeries(329) },
    { name: 'pay.kapitalbank.az', total_requests: 64200, percent_change: 15.3, data: makeSeries(214) },
    { name: 'id.kapitalbank.az', total_requests: 31800, percent_change: -6.7, data: makeSeries(106) }
  ];

  const top_paths = [
    { path: '/v2/auth/oauth2/token', requests: 48520 },
    { path: '/api/v1/cards/transactions/stream', requests: 42100 },
    { path: '/api/v3/transfers/p2p/execute', requests: 36740 },
    { path: '/v1/client/accounts/balances', requests: 31200 },
    { path: '/api/v2/notifications/push/sync', requests: 27950 },
    { path: '/v1/payments/utility/inquire', requests: 24100 },
    { path: '/api/v2/exchange-rates/live', requests: 19800 },
    { path: '/v1/security/mfa/challenge', requests: 16500 },
    { path: '/api/v1/cards/limits/update', requests: 12400 },
    { path: '/v1/locations/atm/nearby', requests: 9800 }
  ];

  const top_ips = [
    { ip: '185.122.45.10', requests: 18450 },
    { ip: '194.27.18.92', requests: 14200 },
    { ip: '212.47.195.4', requests: 11900 },
    { ip: '82.194.16.88', requests: 9640 },
    { ip: '5.197.240.12', requests: 8320 },
    { ip: '31.200.14.77', requests: 7100 },
    { ip: '91.218.152.3', requests: 6450 },
    { ip: '178.62.204.1', requests: 5200 },
    { ip: '46.101.99.34', requests: 4600 },
    { ip: '188.166.42.9', requests: 3950 }
  ];

  const secondary_zones = [
    {
      zone_id: 'z-birbank',
      zone_name: 'birbank.az',
      top_subdomains: [
        { name: 'api.birbank.az', total_requests: 84200, percent_change: 6.2, data: [] },
        { name: 'id.birbank.az', total_requests: 45100, percent_change: 2.1, data: [] },
        { name: 'pay.birbank.az', total_requests: 38900, percent_change: -1.4, data: [] }
      ],
      top_paths: [
        { path: '/api/v1/qr-pay', requests: 22400 },
        { path: '/api/v2/cashback/offers', requests: 18100 },
        { path: '/v1/bonuses/summary', requests: 14200 }
      ]
    },
    {
      zone_id: 'z-kconnect',
      zone_name: 'k-connect.az',
      top_subdomains: [
        { name: 'gateway.k-connect.az', total_requests: 39800, percent_change: 9.4, data: [] },
        { name: 'pos.k-connect.az', total_requests: 26400, percent_change: 4.0, data: [] },
        { name: 'partner.k-connect.az', total_requests: 18200, percent_change: -3.8, data: [] }
      ],
      top_paths: [
        { path: '/api/v1/partner/webhook', requests: 12100 },
        { path: '/pos/terminal/handshake', requests: 9400 },
        { path: '/auth/api-keys/validate', requests: 7800 }
      ]
    }
  ];

  res.json({
    zone_id: 'z-kapitalbank',
    zone_name: 'kapitalbank.az',
    range: 'last_30_minutes',
    server_time: new Date().toISOString(),
    subdomains,
    top_paths,
    top_ips,
    secondary_zones
  });
});

// Settings Endpoints
app.get('/api/settings', (_req, res) => {
  res.json(mockSettings);
});

app.put('/api/settings', (req, res) => {
  const { api_token, clear_api_token, subdomains, secondary_domains } = req.body || {};

  if (clear_api_token) {
    mockSettings.has_api_token = false;
  } else if (api_token && typeof api_token === 'string' && api_token.trim().length > 0) {
    mockSettings.has_api_token = true;
  }

  if (Array.isArray(subdomains)) {
    mockSettings.subdomains = subdomains.map(s => String(s).trim().toLowerCase()).filter(Boolean);
  }

  if (Array.isArray(secondary_domains)) {
    mockSettings.secondary_domains = secondary_domains.map(s => String(s).trim().toLowerCase()).filter(Boolean);
  }

  res.json(mockSettings);
});

// Page routes matching FastAPI
app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/login.html'));
});

app.get(['/', '/subdomains', '/settings'], (_req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

// Catch-all
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cloudflare SOC Video Wall running on http://0.0.0.0:${PORT}`);
});
