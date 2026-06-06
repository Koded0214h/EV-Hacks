# Local Development Setup

## Prerequisites

- Python 3.12+
- Node.js 20+
- Git

---

## Backend

```bash
cd backend

# Create and activate virtualenv
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env (copy from example below)
cp .env.example .env               # edit with your values

# Run migrations (creates SQLite db locally)
python manage.py migrate

# Start dev server
python manage.py runserver
```

API runs at `http://localhost:8000`.  
Swagger UI: `http://localhost:8000/api/docs/`

### Backend `.env` (local)

```env
SECRET_KEY=dev-secret-key-change-in-prod
DEBUG=True

# Leave DATABASE_URL blank to use local SQLite
DATABASE_URL=

# Get a free key at https://aistudio.google.com/
GEMINI_API_KEY=

# Leave blank — SageMaker disabled by default
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=eu-west-1
SAGEMAKER_ENDPOINT_NAME=evh-demand-v1
USE_SAGEMAKER=False
```

### First-time admin setup (optional)

```bash
python manage.py createsuperuser
# Then open http://localhost:8000/admin/
```

---

## Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create .env (copy from example below)
cp .env.example .env

# Start dev server
npm run dev
```

App runs at `http://localhost:5173`.

### Frontend `.env` (local)

```env
# Get a free token at https://account.mapbox.com/
VITE_MAPBOX_TOKEN=pk.eyJ1...

VITE_API_BASE=http://localhost:8000/api/v1
VITE_INGEST_URL=http://localhost:8000/ingest
```

---

## Running both together

Open two terminals:

```bash
# Terminal 1
cd backend && source .venv/bin/activate && python manage.py runserver

# Terminal 2
cd frontend && npm run dev
```

---

## Useful backend commands

```bash
# Reset local database
rm backend/db.sqlite3 && python manage.py migrate

# Run with stub data (no DB needed)
# Set USE_STUBS=True in the relevant view file

# Check all views load
python -c "
import os; os.environ['DJANGO_SETTINGS_MODULE']='evhacks.settings'
import django; django.setup()
from accounts.views import register, login, me
from roi.views import roi_calculate, roi_compare
from mobility.views import mobility_ping, mobility_heatmap
print('All views OK')
"
```

## Useful frontend commands

```bash
# Production build (check for errors before deploying)
npm run build

# Preview the production build locally
npm run preview

# Lint
npm run lint
```

---

## Connecting to production DB locally

Not recommended for regular dev, but if needed:

```env
# backend/.env
DATABASE_URL=postgresql://neondb_owner:...@ep-silent-mountain...neon.tech/neondb?sslmode=require
```

Then `python manage.py migrate` to ensure schema is up to date.
