# Architecture

## System overview

```
                         ┌──────────────────────────────────┐
                         │         React PWA (Vite 8)        │
                         │  Dashboard · Driver · Landing     │
                         │  Mapbox GL · Framer · jsPDF       │
                         └──────────────┬───────────────────┘
                                        │ HTTPS / JWT Bearer
                         ┌──────────────▼───────────────────┐
                         │         Django 4.2 + DRF          │
                         │   EC2 · Docker · Gunicorn         │
                         │   simplejwt · drf-spectacular     │
                         └───┬──────────┬──────────┬────────┘
                             │          │          │
                  ┌──────────▼─┐  ┌─────▼────┐  ┌─▼──────────────┐
                  │ Neon Postgres│  │  Redis   │  │  Gemini 2.5    │
                  │ (production) │  │  (cache) │  │  Flash (brief) │
                  └─────────────┘  └──────────┘  └────────────────┘
                                                        │
                                               ┌────────▼────────┐
                                               │ SageMaker (ML)  │
                                               │  demand score   │
                                               │  feature-flagged│
                                               └─────────────────┘
```

## Request flow — Investor ROI

```
1. Browser → GET /api/v1/zones/
   Django → zones/views.py → STUB_ZONES → JSON
   Mapbox GL renders choropleth circles

2. User clicks zone → zone panel opens (client-side)

3. User clicks "Calculate ROI"
   Browser → POST /api/v1/roi/calculate/
   Django → roi/views.py → calculator.py → 3 scenarios
   (optional) → ml/client.py → SageMaker invoke_endpoint
   Response cached in Redis 5 min

4. User clicks "Generate Brief"
   Browser → POST /api/v1/brief/generate/
   Django → brief/views.py → google.generativeai → Gemini 2.5 Flash
   Returns: headline, summary, key_metrics, risk_factors, recommendation

5. User clicks "Export PDF"
   Client-side only — dynamic import('jspdf')
   Renders A4 PDF from brief state, saves to disk
```

## Request flow — Driver mobility

```
1. Driver app loads → POST /api/v1/mobility/ping/ every 30s
   Stores: lat, lng, speed, session_id, zone_id (bbox lookup)

2. Investor dashboard → GET /api/v1/mobility/heatmap/?hours=24
   Aggregates pings → GeoJSON FeatureCollection with weights
   Mapbox GL renders heatmap layer

3. Driver starts charging → POST /api/v1/charging/start/
   Returns: session_id
   Driver stops → POST /api/v1/charging/stop/
   Stores: kwh_delivered, duration_seconds, cost_ngn
```

## Auth flow

```
Register/Login → POST /api/v1/auth/login/
Response: { "access": "<JWT>", "user": {...} }

JWT stored in localStorage (evhacks_token)
All authenticated requests: Authorization: Bearer <JWT>
Token lifetime: 12 hours (ACCESS_TOKEN_LIFETIME)

On page refresh: getToken() → api.auth.me() → restore session
On logout: clearAuth() removes token + cached user
```

## Data model (simplified)

```
UserProfile         ← extends Django User
  company, role, phone, vehicle

Zone (stubs)        zones/stubs.py → STUB_ZONES list
  zone_id, name, geometry (GeoJSON), centroid, demand_score,
  tier, pop_density, poi_count, ev_traffic, station_count

Station             zones/models.py
  station_id, name, operator, lat, lng, type, ports, status

MobilityPing        mobility/models.py
  session_id, location_lat, location_lng, speed_kmh, zone_id

ChargingSession     charging/models.py
  session_id, station_id, kwh_delivered, duration_seconds, cost_ngn
```

## Feature flags

| Flag | Default | Effect |
|---|---|---|
| `USE_STUBS` | `False` | Return stub data instead of DB queries |
| `USE_SAGEMAKER` | `False` | Call SageMaker endpoint for demand score; falls back to deterministic formula |
| `DEBUG` | `False` | Django debug mode |

## Infrastructure (production)

```
GitHub main push
       │
       ▼
GitHub Actions (deploy-backend.yml)
  · Build Docker image
  · Push to ECR (eu-west-1)
  · SSH into EC2 → docker compose pull + up
       │
       ▼
EC2 (34.251.241.87)
  docker-compose:
    api: evh/api:latest  → port 8000
  Nginx (optional): reverse proxy on :80

Frontend:
  npm run build → dist/ → served from EC2 or static host
```

## CDK stacks (infra/)

| Stack | Services |
|---|---|
| `EvhNetworkStack` | VPC (2 AZ), NAT, Security Groups, Secrets Manager |
| `EvhDataStack` | RDS PostgreSQL 16, ElastiCache Redis 7, S3 |
| `EvhAuthStack` | Cognito User Pool (architecture only — app uses simplejwt) |
| `EvhIngestStack` | API Gateway → Lambda → Kinesis → Firehose → S3 |
| `EvhComputeStack` | ECR, ECS Fargate, ALB |
| `EvhMlStack` | SageMaker Model + Endpoint |
