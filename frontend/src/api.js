const BASE = 'http://localhost:8000/api/v1'
const TOKEN_KEY = 'evhacks_token'
const USER_KEY  = 'evhacks_user'

// ── Token storage ──────────────────────────────────────────────
export function getToken()    { return localStorage.getItem(TOKEN_KEY) }
export function setToken(t)   { localStorage.setItem(TOKEN_KEY, t) }
export function clearAuth()   { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY) }
export function getCachedUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
}
export function setCachedUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)) }

// ── Base fetch ─────────────────────────────────────────────────
function authHeaders() {
  const t = getToken()
  return t ? { Authorization: `Token ${t}` } : {}
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() })
  if (!res.ok) throw await _makeErr(res, `GET ${path}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await _makeErr(res, `POST ${path}`)
  return res.json()
}

async function patch(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await _makeErr(res, `PATCH ${path}`)
  return res.json()
}

async function _makeErr(res, label) {
  let data = {}
  try { data = await res.json() } catch {}
  const err = new Error(data.message || `${label} → ${res.status}`)
  err.status = res.status
  err.data = data
  return err
}

// ── API surface ────────────────────────────────────────────────
export const api = {
  auth: {
    register: (form)           => post('/auth/register/', form),
    login:    (email, password) => post('/auth/login/',    { email, password }),
    logout:   ()               => post('/auth/logout/',   {}),
    me:       ()               => get('/auth/me/'),
    updateProfile: (fields)    => patch('/auth/profile/',  fields),
  },
  getZones:    ()       => get('/zones/'),
  getStations: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return get(`/stations/${qs ? '?' + qs : ''}`)
  },
  calculateROI:   (payload)            => post('/roi/calculate/',  payload),
  generateBrief:  (zoneId, roiResult)  => post('/brief/generate/', { zone_id: zoneId, roi_result: roiResult }),
  reportStation:  (stationId, status)  => post('/stations/report/', { station_id: stationId, status, reporter_type: 'driver' }),
  getMobilityHeatmap: (hours = 24)     => get(`/mobility/heatmap/?hours=${hours}`),
}

// ── Data mappers ───────────────────────────────────────────────
const TIER_MAP      = { hot: 'A', warm: 'B', cold: 'C' }
const TYPE_LABEL    = { dc_fast: 'DC Fast', ac_level2: 'AC Level 2', swap: 'Battery Swap' }
const TYPE_LABEL_DV = { dc_fast: 'DC Fast Charge', ac_level2: 'AC Level 2' }

export function mapZone(z) {
  const score   = Math.round(Number(z.demand_score))
  const tier    = TIER_MAP[z.tier] ?? (score >= 65 ? 'B' : score >= 50 ? 'C' : 'D')
  const lat     = z.centroid?.lat ?? 6.5244
  const lng     = z.centroid?.lng ?? 3.3792
  const density = Number(z.pop_density ?? 0)
  return {
    id:        z.zone_id,
    zoneId:    z.zone_id,
    name:      z.name,
    score,
    tier,
    lat,
    lng,
    radiusKm:  1.1,
    pop:       density > 5000 ? 'High' : density > 2500 ? 'Medium' : 'Low',
    poi:       z.poi_count,
    evTraffic: `${Math.round(Number(z.ev_traffic) * 3500).toLocaleString()}/day`,
    existing:  z.station_count,
  }
}

export function mapStation(s) {
  return {
    id:       s.station_id,
    name:     s.name || 'Unnamed Station',
    status:   s.status,
    type:     TYPE_LABEL[s.type] ?? s.type,
    ports:    s.ports,
    capex:    7000000,
    zone:     null,
    lng:      s.lng,
    lat:      s.lat,
    planted:  false,
    operator: s.operator,
  }
}

export function mapDriverStation(s, idx) {
  const portsAvail = s.status === 'available' ? s.ports
    : s.status === 'busy' ? Math.max(0, s.ports - Math.ceil(s.ports * 0.7))
    : 0
  const priceMap = { dc_fast: 185, ac_level2: 170, swap: 160 }
  return {
    id:             idx + 1,
    stationId:      s.station_id,
    name:           s.name || 'Unnamed Station',
    status:         s.status,
    portsAvailable: portsAvail,
    portsTotal:     s.ports,
    type:           TYPE_LABEL_DV[s.type] ?? s.type,
    distanceKm:     null,
    pricePerKwh:    priceMap[s.type] ?? 175,
    rating:         null,
    reviews:        null,
    address:        s.operator ? `Operated by ${s.operator}` : s.name,
    amenities:      ['Parking'],
    lng:            s.lng,
    lat:            s.lat,
    waitMins:       s.status === 'busy' ? 20 : null,
  }
}

export function mapROIResult(data) {
  const fmt    = (n) => n != null ? `₦${Math.round(n).toLocaleString('en-NG')}` : '—'
  const fmtPct = (n) => n != null ? `${Math.round(n)}%` : '—'
  const fmtMo  = (n) => n != null ? `${Math.round(n)} mo` : '—'
  const CFG = {
    conservative: { color: '#64748B', bg: 'rgba(148,163,184,.08)', label: 'Conservative' },
    base:         { color: '#16A34A', bg: 'rgba(22,163,74,.06)',   label: 'Base Case'    },
    optimistic:   { color: '#4ade80', bg: 'rgba(74,222,128,.08)',  label: 'Optimistic'   },
  }
  return ['conservative', 'base', 'optimistic'].map(key => {
    const s = data.scenarios[key]
    return {
      ...CFG[key],
      annual:  fmt(s.monthly_gross_ngn * 12),
      monthly: fmt(s.monthly_net_ngn),
      payback: fmtMo(s.payback_months),
      roi:     fmtPct(s.roi_12m_pct),
    }
  })
}
