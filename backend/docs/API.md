# EV Hacks API Documentation

Base URL (dev): `http://localhost:8000/api/v1`
Base URL (prod): `https://api.evhacks.ng/api/v1`

Interactive docs: `http://localhost:8000/api/docs/`

All responses are `Content-Type: application/json`.
Error shape: `{"error": true, "message": "...", "code": "ERR_CODE"}`

---

## Health Check

### `GET /`
```json
{"status": "ok", "version": "1.0.0"}
```

---

## Zones

### `GET /zones/`
Returns all zones with demand scores. Used by Koded to render the choropleth heatmap.

**Response**
```json
{
  "count": 3,
  "zones": [
    {
      "zone_id": "lagos_lekki_1",
      "name": "Lekki Phase 1",
      "geometry": { "type": "Polygon", "coordinates": [[...]] },
      "centroid": { "lat": 6.4281, "lng": 3.4219 },
      "demand_score": 87.4,
      "tier": "hot",
      "pop_density": 4200.0,
      "poi_count": 312,
      "ev_traffic": 0.78,
      "station_count": 2
    }
  ]
}
```

---

### `GET /zones/:zone_id/`
Returns a single zone. Called when user clicks a zone on the map.

**Example:** `GET /zones/lagos_lekki_1/`

**Response:** Single ZoneFeature object (same shape as above)

**404 if zone not found**
```json
{"error": true, "message": "Zone not found", "code": "ERR_NOT_FOUND"}
```

---

### `GET /zones/bbox/`
Returns zones within a bounding box. Used for progressive map loading.

**Query params**
| Param | Type | Description |
|---|---|---|
| sw_lat | float | South-west latitude |
| sw_lng | float | South-west longitude |
| ne_lat | float | North-east latitude |
| ne_lng | float | North-east longitude |

**Example:** `GET /zones/bbox/?sw_lat=6.4&sw_lng=3.3&ne_lat=6.6&ne_lng=3.5`

**Response**
```json
{"zones": [...]}
```

---

## Stations

### `GET /stations/`
All stations with live status. Koded renders these as map pins.

**Query params (all optional)**
| Param | Type | Description |
|---|---|---|
| lat | float | Filter by proximity |
| lng | float | Filter by proximity |
| radius_km | float | Radius in km |
| type | string | `ac_level2` \| `dc_fast` \| `swap` |
| status | string | `available` \| `busy` \| `offline` |

**Response**
```json
{
  "count": 3,
  "stations": [
    {
      "station_id": "sta-001",
      "name": "Lekki Phase 1 Hub",
      "operator": "Qoray Energy",
      "lat": 6.4281,
      "lng": 3.4219,
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
Crowdsourced station status update.

**Request**
```json
{
  "station_id": "sta-001",
  "status": "busy",
  "reporter_type": "driver",
  "note": "Queue of 3 vehicles"
}
```

**Response**
```json
{"success": true, "station_id": "sta-001", "new_status": "busy"}
```

---

## ROI Engine

### `POST /roi/calculate/`
Core ROI calculation. Returns 3 financial scenarios. Results cached in Redis — same inputs return instantly (< 500ms).

**Request**
```json
{
  "lat": 6.4281,
  "lng": 3.4219,
  "zone_id": "lagos_lekki_1",
  "station_type": "dc_fast",
  "num_ports": 4,
  "capex_ngn": 12000000,
  "opex_monthly_ngn": 450000,
  "target_segment": "mixed",
  "demand_score": 87.4,
  "competitor_count": 2
}
```

**`station_type`:** `ac_level2` | `dc_fast`
**`target_segment`:** `commercial` | `private` | `mixed`

**Response**
```json
{
  "location": {"lat": 6.4281, "lng": 3.4219, "name": "Lekki Phase 1"},
  "station_type": "dc_fast",
  "num_ports": 4,
  "capex_ngn": 12000000,
  "opex_monthly_ngn": 450000,
  "scenarios": {
    "conservative": {
      "daily_sessions_per_port": 7.58,
      "avg_revenue_per_session_ngn": 1800.0,
      "monthly_gross_ngn": 1641600.0,
      "monthly_net_ngn": 1191600.0,
      "payback_months": 10.07,
      "roi_12m_pct": 19.16
    },
    "base": { "...same shape..." },
    "optimistic": { "...same shape..." }
  },
  "demand_score": 87.4,
  "competitor_count": 2,
  "recommendation": "Strong investment case — 5.6-month payback and 114% 12-month ROI in the base scenario."
}
```

---

### `GET /roi/compare/`
Compare ROI across multiple zones side by side.

**Query params**
| Param | Type | Description |
|---|---|---|
| zone_ids | string | Comma-separated zone IDs |
| station_type | string | `ac_level2` \| `dc_fast` |
| num_ports | int | Number of ports |
| capex_ngn | float | Capital expenditure |
| opex_monthly_ngn | float | Monthly operating cost |
| target_segment | string | `commercial` \| `private` \| `mixed` |

**Example:** `GET /roi/compare/?zone_ids=lagos_lekki_1,lagos_yaba_1&station_type=dc_fast&num_ports=4&capex_ngn=12000000&opex_monthly_ngn=450000&target_segment=mixed`

**Response**
```json
{"comparisons": [ROIResult, ROIResult]}
```

---

## Mobility

### `POST /mobility/ping/`
Ingest a GPS ping from the driver PWA.

**Request**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "lat": 6.4281,
  "lng": 3.4219,
  "speed_kmh": 34.2,
  "recorded_at": "2025-06-06T08:00:00Z"
}
```

**Response**
```json
{"success": true, "zone_id": "lagos_lekki_1"}
```

---

### `GET /mobility/heatmap/`
Aggregated ping density as GeoJSON. Koded renders this as the mobility overlay layer.

**Query params**
| Param | Type | Description |
|---|---|---|
| hours | int | `24` (default) or `168` (7 days) |

**Response**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [3.4219, 6.4281]},
      "properties": {"weight": 0.9}
    }
  ]
}
```

---

## AI Brief

### `POST /brief/generate/`
Proxies to Fluxx's internal LLM service. Returns AI-generated investor brief. Target: < 8 seconds.

**Request**
```json
{
  "zone_id": "lagos_lekki_1",
  "roi_result": { "...full ROIResult object..." }
}
```

**Response**
```json
{
  "brief_id": "uuid",
  "zone_id": "lagos_lekki_1",
  "generated_at": "2025-06-06T08:00:00Z",
  "headline": "Lekki Phase 1 offers a sub-12-month payback on DC fast charging.",
  "summary": "2-3 paragraph narrative...",
  "key_metrics": [
    {"label": "Demand Score", "value": "87.4 / 100"},
    {"label": "Payback Period", "value": "5.6 months"}
  ],
  "risk_factors": ["Grid reliability risk", "EV adoption uncertainty", "Regulatory risk"],
  "recommendation": "Go. Strong fundamentals, fast payback."
}
```

**Error (Fluxx service down)**
```json
{"error": true, "message": "...", "code": "ERR_BRIEF_SERVICE"}
```

---

## How the Demo Path Connects

```
Koded map loads → GET /zones/ → renders choropleth
User clicks zone → GET /zones/:zone_id/ → ZonePanel opens
User clicks ROI → POST /roi/calculate/ → ScenarioTable renders
User clicks Brief → POST /brief/generate/ → BriefModal opens
Mobility toggle → GET /mobility/heatmap/ → heatmap layer renders
Driver PWA → POST /mobility/ping/ → pings ingested
```
