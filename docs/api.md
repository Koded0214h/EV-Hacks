# API Reference

**Base URL (dev):** `http://localhost:8000/api/v1`  
**Base URL (prod):** `http://34.251.241.87/api/v1`  
**Interactive docs:** `http://localhost:8000/api/docs/` (Swagger UI)

All responses are `application/json`.  
Error shape: `{"error": true, "message": "...", "code": "ERR_CODE"}`

Authentication: `Authorization: Bearer <JWT>` on protected routes.

---

## Health

### `GET /`
```json
{"status": "ok", "version": "1.0.0"}
```

---

## Auth

### `POST /auth/register/`
Create a new account. Returns a JWT access token.

**Request**
```json
{
  "name": "Amaka Okonkwo",
  "email": "amaka@zenithcap.ng",
  "password": "secure123",
  "company": "Zenith Capital",
  "role": "Angel Investor",
  "phone": "08012345678",
  "vehicle": "BYD Seal"
}
```

**Response `201`**
```json
{
  "access": "<JWT>",
  "user": {
    "id": 1,
    "name": "Amaka Okonkwo",
    "email": "amaka@zenithcap.ng",
    "company": "Zenith Capital",
    "role": "Angel Investor",
    "phone": "08012345678",
    "vehicle": ""
  }
}
```

**Errors:** `400 ERR_VALIDATION` · `400 ERR_DUPLICATE`

---

### `POST /auth/login/`
Authenticate and get a JWT.

**Request**
```json
{"email": "amaka@zenithcap.ng", "password": "secure123"}
```

**Response `200`**
```json
{"access": "<JWT>", "user": {...}}
```

**Errors:** `400 ERR_VALIDATION` · `401 ERR_AUTH`

---

### `POST /auth/logout/`
Stateless — clears client-side. Always returns `200`.

```json
{"success": true}
```

---

### `GET /auth/me/` 🔒
Returns the authenticated user.

```json
{"id": 1, "name": "Amaka Okonkwo", "email": "...", "company": "...", "role": "...", "phone": "...", "vehicle": "..."}
```

---

### `PATCH /auth/profile/` 🔒
Update name, company, role, phone, or vehicle.

```json
{"name": "Amaka O.", "company": "Zenith Cap"}
```

---

## Zones

### `GET /zones/`
All demand zones with scores. Rendered as choropleth circles on the map.

**Response**
```json
{
  "count": 22,
  "zones": [
    {
      "zone_id": "lagos_lekki_1",
      "name": "Lekki Phase 1",
      "geometry": {"type": "Polygon", "coordinates": [[...]]},
      "centroid": {"lat": 6.4698, "lng": 3.5852},
      "demand_score": 87.4,
      "tier": "hot",
      "pop_density": 4200.0,
      "poi_count": 142,
      "ev_traffic": 0.78,
      "station_count": 1
    }
  ]
}
```

**Tier values:** `hot` (80+) · `warm` (65–79) · `cold` (50–64) · `low` (<50)

---

### `GET /zones/:zone_id/`
Single zone. `404` if not found.

---

### `GET /zones/bbox/`
Zones within a bounding box.

| Param | Type | Example |
|---|---|---|
| `sw_lat` | float | `6.4` |
| `sw_lng` | float | `3.3` |
| `ne_lat` | float | `6.6` |
| `ne_lng` | float | `3.5` |

---

## Stations

### `GET /stations/`
All stations with live status.

| Param | Type | Description |
|---|---|---|
| `lat` | float | Filter by proximity |
| `lng` | float | Filter by proximity |
| `radius_km` | float | Radius in km |
| `type` | string | `ac_level2` · `dc_fast` · `swap` |
| `status` | string | `available` · `busy` · `offline` |

**Response**
```json
{
  "count": 5,
  "stations": [
    {
      "station_id": "sta-001",
      "name": "Lekki Charge Hub",
      "operator": "Qoray Energy",
      "lat": 6.4712, "lng": 3.5891,
      "type": "dc_fast",
      "ports": 4,
      "status": "available",
      "utilisation": 0.45,
      "last_seen": "2025-06-06T08:00:00Z"
    }
  ]
}
```

---

### `POST /stations/report/`
Crowdsourced status update from a driver.

```json
{"station_id": "sta-001", "status": "busy", "reporter_type": "driver"}
```

```json
{"success": true, "station_id": "sta-001", "new_status": "busy"}
```

---

### `POST /stations/plant/` 🔒
Save a hypothetical station from the investor map planner.

```json
{"lat": 6.47, "lng": 3.59, "name": "My Lekki Station", "station_type": "dc_fast", "num_ports": 4}
```

```json
{"success": true, "station_id": "planted-..."}
```

---

### `GET /stations/planted/` 🔒
Returns stations planted by the authenticated investor.

---

## ROI Engine

### `POST /roi/calculate/`
Core ROI calculation. Returns 3 financial scenarios. Results cached in Redis for 5 min.

**Request**
```json
{
  "lat": 6.4698,
  "lng": 3.5852,
  "zone_id": "lagos_lekki_1",
  "station_type": "dc_fast",
  "num_ports": 4,
  "capex_ngn": 8000000,
  "opex_monthly_ngn": 450000,
  "target_segment": "mixed",
  "demand_score": 87,
  "competitor_count": 1
}
```

`station_type`: `ac_level2` · `dc_fast`  
`target_segment`: `commercial` · `private` · `mixed`

**Response**
```json
{
  "location": {"lat": 6.4698, "lng": 3.5852, "name": "Lekki Phase 1"},
  "station_type": "dc_fast",
  "scenarios": {
    "conservative": {
      "daily_sessions_per_port": 7.6,
      "avg_revenue_per_session_ngn": 1800,
      "monthly_gross_ngn": 1641600,
      "monthly_net_ngn": 1191600,
      "payback_months": 6.7,
      "roi_12m_pct": 79
    },
    "base": {"...same shape..."},
    "optimistic": {"...same shape..."}
  },
  "demand_score": 87,
  "competitor_count": 1,
  "recommendation": "Strong investment case — 6.7-month payback at base."
}
```

---

### `GET /roi/compare/`
Compare ROI across multiple zones side by side.

| Param | Example |
|---|---|
| `zone_ids` | `lagos_lekki_1,lagos_vi_1` |
| `station_type` | `dc_fast` |
| `num_ports` | `4` |
| `capex_ngn` | `8000000` |
| `opex_monthly_ngn` | `450000` |
| `target_segment` | `mixed` |

```json
{"comparisons": [ROIResult, ROIResult]}
```

---

## Mobility

### `POST /mobility/ping/`
Ingest a GPS ping from the driver PWA. Zone is looked up via bbox containment.

```json
{
  "session_id": "uuid",
  "lat": 6.4698, "lng": 3.5852,
  "speed_kmh": 34.2,
  "recorded_at": "2025-06-06T08:00:00Z"
}
```

```json
{"success": true, "zone_id": "lagos_lekki_1"}
```

---

### `GET /mobility/heatmap/`
Aggregated ping density as GeoJSON. Rendered as a heatmap layer on the investor map.

| Param | Values |
|---|---|
| `hours` | `24` (default) · `168` |

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [3.5852, 6.4698]},
      "properties": {"weight": 0.9}
    }
  ]
}
```

---

## AI Brief

### `POST /brief/generate/` 🔒
Generates an investor brief via Gemini 2.5 Flash. Target latency: < 8 seconds.

**Request**
```json
{
  "zone_id": "lagos_lekki_1",
  "roi_result": {"...full ROIResult object..."}
}
```

**Response**
```json
{
  "brief_id": "uuid",
  "zone_id": "lagos_lekki_1",
  "generated_at": "2025-06-06T08:00:00Z",
  "headline": "Lekki Phase 1 offers a sub-7-month payback on DC fast charging.",
  "summary": "2-3 paragraph narrative...",
  "key_metrics": [
    {"label": "Demand Score", "value": "87/100"},
    {"label": "Payback Period", "value": "6.7 months"},
    {"label": "12-Month ROI", "value": "79%"}
  ],
  "risk_factors": ["Grid reliability", "EV adoption pace", "Regulatory risk"],
  "recommendation": "Go. Strong fundamentals and fast payback."
}
```

---

## Charging Sessions

### `POST /charging/start/` 🔒

```json
{"station_id": "sta-001", "station_name": "Lekki Charge Hub", "price_per_kwh": 185}
```
```json
{"session_id": "uuid", "started_at": "2025-06-06T08:00:00Z"}
```

---

### `POST /charging/stop/` 🔒

```json
{"session_id": "uuid", "kwh_delivered": 22.5, "duration_seconds": 3680}
```
```json
{"success": true, "cost_ngn": 4162}
```

---

### `GET /charging/history/` 🔒

```json
{
  "session_count": 12,
  "total_kwh": 186.4,
  "total_cost_ngn": 34484,
  "sessions": [
    {
      "session_id": "uuid",
      "station_name": "Lekki Charge Hub",
      "started_at": "2025-06-06T08:00:00Z",
      "duration_seconds": 3680,
      "kwh_delivered": 22.5,
      "cost_ngn": 4162
    }
  ]
}
```

---

## Error codes

| Code | Meaning |
|---|---|
| `ERR_VALIDATION` | Missing or invalid field |
| `ERR_DUPLICATE` | Email already registered |
| `ERR_AUTH` | Wrong credentials |
| `ERR_NOT_FOUND` | Resource doesn't exist |
| `ERR_BRIEF_SERVICE` | Gemini API unavailable |
