# EV Hacks

Nigeria's missing EV infrastructure intelligence layer — built for investors who need to know where to deploy capital, and drivers who need to find a charge.

**One With AI Hackathon 2026**

---

## What it does

| View | Who | Core features |
|---|---|---|
| Investor Dashboard | Fund managers, grid operators | Demand zone map, ROI calculator (3 scenarios), AI investor brief, PDF export, station planner |
| Driver View | EV drivers | Live station availability, in-app navigation, charging session tracker, crowdsourced status reports |

---

## Stack

```
Frontend          React 19 · Vite 8 · Tailwind · Mapbox GL JS · Framer Motion · jsPDF
Backend           Django 4.2 · DRF · djangorestframework-simplejwt · Gemini 2.5 Flash
Database          Neon PostgreSQL (production) · SQLite (local dev)
Cache             Redis (ElastiCache in prod)
ML                AWS SageMaker sklearn endpoint · deterministic fallback (feature-flagged)
Infra             EC2 · Docker · ECR · GitHub Actions CI/CD
IaC               AWS CDK (Python) — VPC, ECS Fargate, RDS, Kinesis, Cognito
```

---

## Project structure

```
EV-Hacks/
├── backend/                  Django API
│   ├── accounts/             Auth (register, login, JWT)
│   ├── zones/                Demand zone data + scoring
│   ├── roi/                  ROI calculation engine
│   ├── mobility/             GPS ping ingest + heatmap
│   ├── brief/                AI investor brief (Gemini)
│   ├── charging/             Charging session tracking
│   ├── ml/                   SageMaker client + training script
│   └── evhacks/              Django settings + URLs
├── frontend/                 React PWA
│   └── src/
│       ├── pages/            Dashboard.jsx · DriverView.jsx · Landing.jsx
│       ├── api.js            API client + data mappers
│       └── components/
├── infra/                    AWS CDK stacks (Python)
│   └── infra/stacks/         network · data · auth · ingest · compute · ml
└── docs/                     Architecture, API reference, setup guides
```

---

## Quick start

See [`docs/setup.md`](docs/setup.md) for full local dev instructions.

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`. API at `http://localhost:8000/api/v1/`.

Interactive API docs: `http://localhost:8000/api/docs/`

---

## Docs

| Document | Description |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | System design and data flow |
| [`docs/api.md`](docs/api.md) | Full API reference |
| [`docs/setup.md`](docs/setup.md) | Local development setup |
| [`docs/deployment.md`](docs/deployment.md) | EC2 production deployment + CI/CD |
| [`docs/ml.md`](docs/ml.md) | SageMaker demand scoring model |

---

## Environment variables

**Backend** (`backend/.env`):
```
SECRET_KEY=
DEBUG=False
DATABASE_URL=postgresql://...
GEMINI_API_KEY=
EC2_URL=http://...
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=eu-west-1
SAGEMAKER_ENDPOINT_NAME=evh-demand-v1
USE_SAGEMAKER=False
```

**Frontend** (`frontend/.env`):
```
VITE_MAPBOX_TOKEN=
VITE_API_BASE=http://localhost:8000/api/v1
VITE_INGEST_URL=http://localhost:8000/ingest
```

**Frontend production** (`frontend/.env.production`):
```
VITE_API_BASE=http://34.251.241.87/api/v1
VITE_INGEST_URL=http://34.251.241.87/ingest
```

---

## Deployment

Push to `main` triggers GitHub Actions — builds Docker image, pushes to ECR, SSHes into EC2, pulls and restarts the container. See [`docs/deployment.md`](docs/deployment.md).

```
git push origin main   # → CI/CD auto-deploys backend
```

Frontend: `npm run build` → deploy `dist/` to your host.

---

## Team

Built by **Raufu Abdulraman** · One With AI Hackathon 2026
