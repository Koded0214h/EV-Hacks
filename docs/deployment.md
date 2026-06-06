# Deployment

## Production setup

| Component | Where |
|---|---|
| Backend | EC2 `34.251.241.87` · Docker · port 8000 |
| Database | Neon PostgreSQL (serverless, `eu-west-1`) |
| Container registry | AWS ECR `487054650567.dkr.ecr.eu-west-1.amazonaws.com/evh/api` |
| CI/CD | GitHub Actions → ECR → EC2 (SSH) |
| Frontend | `npm run build` → `dist/` → serve from EC2 or static host |

---

## CI/CD pipeline

Defined in `.github/workflows/deploy-backend.yml`.

**Trigger:** push to `main` with changes in `backend/**`.

**Steps:**
1. Authenticate to AWS via OIDC (no long-lived keys) — role `arn:aws:iam::487054650567:role/evh-github-actions`
2. Build Docker image tagged `<run_number>-<sha>` + `latest`
3. Push both tags to ECR
4. SSH into EC2 as `ec2-user`
5. Pull new image via `docker compose pull api`
6. Restart with `docker compose up -d --no-deps --force-recreate api`
7. Health check: polls `http://localhost:8000/` for 60 seconds

**Required GitHub secrets:**

| Secret | Value |
|---|---|
| `EC2_SSH_PRIVATE_KEY` | Private key for `ec2-user@34.251.241.87` |

AWS credentials come from OIDC — no `AWS_ACCESS_KEY_ID` secret needed.

---

## Manual deployment

If CI/CD is broken or you need to deploy a hotfix:

```bash
# 1. Build and push image locally
aws ecr get-login-password --region eu-west-1 \
  | docker login --username AWS --password-stdin 487054650567.dkr.ecr.eu-west-1.amazonaws.com

docker build -t evh/api ./backend
docker tag evh/api:latest 487054650567.dkr.ecr.eu-west-1.amazonaws.com/evh/api:latest
docker push 487054650567.dkr.ecr.eu-west-1.amazonaws.com/evh/api:latest

# 2. SSH and restart
ssh ec2-user@34.251.241.87
cd /opt/evhacks/app
aws ecr get-login-password --region eu-west-1 \
  | docker login --username AWS --password-stdin 487054650567.dkr.ecr.eu-west-1.amazonaws.com
docker compose pull api
docker compose up -d --no-deps --force-recreate api
docker compose ps
```

---

## EC2 directory layout

```
/opt/evhacks/
└── app/
    ├── docker-compose.yml
    └── .env                  ← production secrets (not in git)
```

The `.env` on EC2 should have:

```env
SECRET_KEY=<strong random key>
DEBUG=False
DATABASE_URL=postgresql://neondb_owner:...@...neon.tech/neondb?sslmode=require
GEMINI_API_KEY=...
EC2_URL=http://34.251.241.87
AWS_DEFAULT_REGION=eu-west-1
SAGEMAKER_ENDPOINT_NAME=evh-demand-v1
USE_SAGEMAKER=False
```

---

## Database migrations

Run once after deploying a new migration:

```bash
ssh ec2-user@34.251.241.87
cd /opt/evhacks/app
docker compose exec api python manage.py migrate
```

Or from local if you have the production `DATABASE_URL`:

```bash
cd backend
DATABASE_URL="postgresql://..." python manage.py migrate
```

---

## Frontend deployment

```bash
cd frontend

# Build for production (uses .env.production)
npm run build

# Option A — copy dist/ to EC2 and serve with Nginx
scp -r dist/ ec2-user@34.251.241.87:/opt/evhacks/frontend/

# Option B — serve from any static host (Vercel, Amplify, S3+CloudFront)
# vercel.json is already configured for SPA routing
```

The `frontend/vercel.json` handles client-side routing rewrites for the `/#/driver` hash route.

---

## Health check

```bash
# API
curl http://34.251.241.87/api/v1/

# Expected
{"status": "ok", "version": "1.0.0"}
```

---

## Rollback

```bash
ssh ec2-user@34.251.241.87
cd /opt/evhacks/app

# List recent images
docker images evh/api

# Roll back to a specific tag
docker compose up -d --no-deps --force-recreate api \
  --image 487054650567.dkr.ecr.eu-west-1.amazonaws.com/evh/api:<previous-tag>
```
