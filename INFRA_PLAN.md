# EV Hacks — AWS Infrastructure Implementation Plan

**Context:** Member account inside the hackathon organizer's AWS Organization.
**Region:** TBD — confirm with organizer (default to `eu-west-1`, fall back to whatever they allow).
**IaC:** AWS CDK (Python) · **Budget:** 12 hours · **Scope:** Mid (core + Kinesis + SageMaker endpoint)

---

## Locked stack

| Layer | Service | Purpose |
|---|---|---|
| Network | VPC (2 AZ, public+private), NAT (1) | Isolate RDS/ECS; NAT for egress |
| Ingest | API Gateway (HTTP API) → Lambda → Kinesis Data Streams → Firehose → S3 | Driver PWA telemetry |
| Compute | ECS Fargate + ALB, ECR | Django + DRF + Celery worker |
| Data | RDS PostgreSQL 16 + PostGIS, ElastiCache Redis | Spatial + cache/queue |
| Storage | S3 (raw, processed, exports), Secrets Manager | Data lake + creds |
| Auth | Cognito User Pool (driver, operator, investor groups) | Role-based access |
| ML | SageMaker real-time endpoint (pre-baked sklearn model) | Demand scoring |
| Frontend | Amplify Hosting (auto CloudFront) | PWA + dashboards |
| Ops | CloudWatch (logs, dashboard, 4 alarms), SNS topic for alerts | Single pane of glass |

**Explicitly out:** Glue, Athena, QuickSight, CodePipeline, DynamoDB. Stub in slides if a judge asks.

---

## Phase 0a — Org reconnaissance (FIRST THING, 20 min)

You're a guest in someone else's AWS Organization. Find out the rules before you build. Send the organizer this exact message:

> "Hey — for EV Hacks I need to confirm: (1) my account ID, (2) which region(s) are allowed under your SCPs, (3) any required resource tags (e.g., `Project`, `Team`, `Owner`), (4) is CDK already bootstrapped in my account, (5) any service denylists I should know about (SageMaker? large EC2?), and (6) is there a spend cap / budget I can see?"

While you wait, run these from your CLI to learn what you can do empirically:

```bash
# 1. Confirm which account/role you're in
aws sts get-caller-identity

# 2. List regions you can actually see
aws ec2 describe-regions --query 'Regions[].RegionName' --output text

# 3. Find out what tag policies the org enforces (may 403 — that's fine, means you can't read but they still apply)
aws organizations describe-organization 2>&1 | head -5
aws organizations list-policies --filter TAG_POLICY 2>&1 | head -5

# 4. Probe service availability in your target region
aws ec2 describe-instance-types --region eu-west-1 --max-items 1 >/dev/null && echo "EC2 OK"
aws sagemaker list-endpoints --region eu-west-1 >/dev/null && echo "SageMaker OK"
aws kinesis list-streams --region eu-west-1 >/dev/null && echo "Kinesis OK"
aws ecs list-clusters --region eu-west-1 >/dev/null && echo "ECS OK"

# 5. Check if CDK is already bootstrapped
aws cloudformation describe-stacks --stack-name CDKToolkit --region eu-west-1 2>&1 | head -3

# 6. Check existing budgets (may 403 if locked at org level)
aws budgets describe-budgets --account-id $(aws sts get-caller-identity --query Account --output text) 2>&1 | head -5
```

**Fill in this matrix before proceeding:**

| Question | Answer |
|---|---|
| My account ID | |
| Role I'm assuming | |
| Allowed region(s) | |
| Required tags | |
| CDK bootstrapped already? | |
| SageMaker allowed? | |
| Spend cap (if any) | |

---

## Phase 0b — Local setup (20 min)

| # | Task | How to verify |
|---|---|---|
| 0.1 | AWS CLI v2 configured with the org-issued profile (`AWS_PROFILE=evhacks-org`). Most orgs use SSO — `aws configure sso`. | `aws sts get-caller-identity --profile evhacks-org` |
| 0.2 | `npm i -g aws-cdk@2 && cdk --version` (≥ 2.140) | Version prints |
| 0.3 | `mkdir infra && cd infra && cdk init app --language python` | `app.py` + `infra/` package exist |
| 0.4 | **Only if not already bootstrapped:** `cdk bootstrap aws://<acct>/<region>`. If it fails with permission errors, ask the organizer for their bootstrap template — they likely pre-baked it. | `CDKToolkit` stack visible |
| 0.5 | **Bake mandatory tags into `app.py`** (do this once, applies everywhere): | `cdk synth` shows tags on every resource |

```python
# infra/app.py
import aws_cdk as cdk
app = cdk.App()
# ... your stacks ...
cdk.Tags.of(app).add("Project", "EVHacks")
cdk.Tags.of(app).add("Team", "<your team name>")
cdk.Tags.of(app).add("Owner", "<your email>")
cdk.Tags.of(app).add("Hackathon", "OneWithAI-2026")
# Add whatever else the org requires
app.synth()
```

| 0.6 | Pre-write **teardown script** `scripts/destroy.sh`. Even if the org cleans up later, you want control. | `cdk destroy --all --force` ready to run |

**Output for team:** AWS console URL (with role-switch link), confirmed region, your IAM identity for tagging context.

---

## Phase 1 — Foundation: VPC + IAM + Secrets (45 min)

Stack: `EvhNetworkStack`

| Resource | CDK construct | Notes |
|---|---|---|
| VPC | `ec2.Vpc(max_azs=2, nat_gateways=1)` | 1 NAT saves cost; some org SCPs cap NATs |
| Subnets | PUBLIC (ALB), PRIVATE_WITH_EGRESS (ECS, Lambda), PRIVATE_ISOLATED (RDS, ElastiCache) | |
| Security groups | `sg_alb`, `sg_ecs`, `sg_rds`, `sg_redis`, `sg_lambda` | Pre-create; refine as you wire services |
| Secrets Manager | `db/master`, `django/secret_key`, `mapbox/token` | Org CloudTrail will see Secrets API calls — fine, just don't print values to logs |
| IAM | Execution roles only — **no IAM users**. ECS task role, Lambda role, SageMaker role. | Org likely blocks IAM user creation via SCP. Use roles + (if org has it) IAM Identity Center for human access. |

**Verify**

```bash
cdk deploy EvhNetworkStack
aws ec2 describe-vpcs --filters Name=tag:Name,Values=EvhVpc --profile evhacks-org
aws secretsmanager list-secrets --profile evhacks-org --query 'SecretList[].Name'
# Confirm tags propagated
aws ec2 describe-vpcs --filters Name=tag:Project,Values=EVHacks --profile evhacks-org \
  --query 'Vpcs[].{id:VpcId,tags:Tags}'
```

**Hand off:** secret ARNs + VPC id in your team channel.

---

## Phase 2 — Data plane: RDS + ElastiCache + S3 (60 min)

Stack: `EvhDataStack`

| Resource | Sizing | Notes |
|---|---|---|
| RDS PostgreSQL 16 | `db.t4g.micro`, 20 GB gp3, single-AZ, **publicly accessible OFF** | Some org SCPs deny public RDS — already off, you're fine. PostGIS via `CREATE EXTENSION postgis;` after first connect. |
| ElastiCache Redis 7 | `cache.t4g.micro`, 1 node, no auth token (in-VPC) | Used for Celery broker + station status cache |
| S3 bucket | `evh-data-<acct>-<region>` with prefixes: `raw/`, `processed/`, `exports/`, `ml/` | Org will likely require `BlockPublicAccess.BLOCK_ALL` + encryption — set both explicitly so deploy doesn't fail |
| S3 bucket | `evh-frontend-assets-<acct>-<region>` | Map tile cache, PDF brand assets |

```python
# Defensive S3 settings — org SCPs commonly require these
s3.Bucket(self, "DataBucket",
    bucket_name=f"evh-data-{self.account}-{self.region}",
    block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
    encryption=s3.BucketEncryption.S3_MANAGED,
    enforce_ssl=True,
    versioned=True,
    removal_policy=cdk.RemovalPolicy.DESTROY,  # hackathon — destroy on teardown
    auto_delete_objects=True,
)
```

**Connect & enable PostGIS** — since RDS is in a private subnet and you can't make an EC2 user, use SSM port-forward through an ECS task or a temporary EC2 with SSM agent:

```bash
# Easiest: spin up a one-shot ECS task with psql, run from there
aws ecs run-task --cluster evh-cluster --task-definition evh-psql-oneshot ...

# Or SSM port-forward if you have an EC2 in the VPC
aws ssm start-session --target i-xxx \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["evh-rds.xxx.eu-west-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5432"]}'

psql "postgresql://master:$PW@localhost:5432/postgres" \
  -c "CREATE EXTENSION IF NOT EXISTS postgis; SELECT PostGIS_Version();"
```

**Verify Redis & S3:** same as before — both from inside the VPC for Redis, from anywhere for S3.

**Hand off:** DB secret ARN (not the raw string), Redis endpoint, S3 bucket name.

---

## Phase 3 — Auth: Cognito (30 min)

Stack: `EvhAuthStack`

- User Pool `evh-users`, self-signup ON, email verification ON
- Groups: `drivers`, `operators`, `investors`
- App clients: `pwa-web` (PKCE, no secret), `api-server` (with secret)
- Hosted UI domain: `evhacks-<short>.auth.<region>.amazoncognito.com`

> **Org gotcha:** if the organizer uses IAM Identity Center org-wide, Cognito is still yours to provision in your account — they don't conflict. Cognito is for your *end users* (drivers/investors), Identity Center is for AWS-console human access.

**Verify**
```bash
aws cognito-idp admin-create-user --user-pool-id <id> \
  --username demo-investor --user-attributes Name=email,Value=demo@evhacks.ng \
  --temporary-password 'Demo!12345' --profile evhacks-org
aws cognito-idp admin-add-user-to-group --user-pool-id <id> \
  --username demo-investor --group-name investors --profile evhacks-org
```

**Hand off:** User pool id, app client ids, Hosted UI domain, three pre-seeded demo users.

---

## Phase 4 — Ingestion: API GW + Lambda + Kinesis + Firehose (90 min)

Stack: `EvhIngestStack`

```
Driver PWA  --POST /ingest-->  API Gateway HTTP API
                                      |
                                      v
                              Lambda (validate + anonymise)
                                      |
                                      v
                              Kinesis Data Stream (1 shard)
                                  /          \
                       Firehose (60s buffer)   Lambda consumer
                              |                       |
                              v                       v
                        S3 raw/ prefix         RDS (live writes)
```

- API GW HTTP API, JWT authorizer = Cognito user pool
- `ingest_lambda` (Python 3.12, 256 MB, 5s timeout): schema-validate, anonymise, `put_record` to Kinesis
- Kinesis stream: 1 shard, on-demand pricing (some orgs cap on-demand — fall back to provisioned 1 shard if SCP denies)
- Firehose: source Kinesis, dest `s3://evh-data-.../raw/pings/`, dynamic partitioning by date
- `processor_lambda` (event source = Kinesis, batch 100, 60s window): bulk insert into PostGIS `mobility_events`

**Verify end-to-end**
```bash
python scripts/seed_pings.py --endpoint https://<apigw>.execute-api.<region>.amazonaws.com/ingest --count 100
aws logs tail /aws/apigateway/evh-ingest --since 5m --profile evhacks-org
aws kinesis describe-stream-summary --stream-name evh-pings --profile evhacks-org
aws s3 ls s3://evh-data-<acct>-<region>/raw/pings/ --recursive --profile evhacks-org
psql ... -c "SELECT count(*) FROM mobility_events WHERE created_at > now() - interval '5 min';"
```

All four green → pipeline alive.

---

## Phase 5 — Compute: ECR + ECS Fargate + ALB (90 min)

Stack: `EvhAppStack`

- ECR repos: `evh/api`, `evh/worker` (with `image_scan_on_push=True` — orgs often require this)
- ECS cluster `evh-cluster` (Fargate)
- Task def `evh-api`: 0.5 vCPU / 1 GB, secrets from Secrets Manager (not env vars in task def — orgs frown on that)
- Task def `evh-worker`: 0.25 vCPU / 0.5 GB, Celery worker
- ALB: HTTPS via ACM cert (use ALB DNS + ACM-issued cert for hackathon; or skip HTTPS and use HTTP on the ALB if no custom domain — judges won't care)
- Auto-scaling: 1–3 tasks, CPU 60% target

**Build & push** (teammate runs):
```bash
aws ecr get-login-password --region <region> --profile evhacks-org \
  | docker login --username AWS --password-stdin <acct>.dkr.ecr.<region>.amazonaws.com
docker build -t evh/api ./backend
docker tag evh/api:latest <acct>.dkr.ecr.<region>.amazonaws.com/evh/api:latest
docker push <acct>.dkr.ecr.<region>.amazonaws.com/evh/api:latest
```

Then `cdk deploy EvhAppStack` (or force a new deployment if image tag is `latest`):
```bash
aws ecs update-service --cluster evh-cluster --service evh-api --force-new-deployment --profile evhacks-org
```

**Verify**
```bash
curl https://<alb-dns>/healthz
curl https://<alb-dns>/api/stations/ -H "Authorization: Bearer $JWT"
aws ecs describe-services --cluster evh-cluster --services evh-api --profile evhacks-org \
  --query 'services[0].{running:runningCount,desired:desiredCount}'
```

**Hand off:** ALB URL, ECR push command, `aws ecs execute-command` snippet for container shell.

---

## Phase 6 — ML: SageMaker endpoint (60 min, conditional)

**Run org check first:**
```bash
aws sagemaker list-endpoints --region <region> --profile evhacks-org
# If this 403s with explicitDeny, the org has SCP'd SageMaker. Skip to the fallback.
```

If allowed: Stack `EvhMlStack`

- Pre-baked sklearn regressor as `model.tar.gz` in `s3://evh-data-.../ml/models/v1/`
- SageMaker `Model` (sklearn 1.2-1), `EndpointConfig` (1 × `ml.t2.medium`), `Endpoint` `evh-demand-v1`
- Django calls via `boto3 sagemaker-runtime invoke_endpoint`

**Verify**
```bash
aws sagemaker-runtime invoke-endpoint --endpoint-name evh-demand-v1 \
  --content-type application/json --body '{"instances":[[6.45,3.40,18,3,2]]}' \
  /tmp/out.json --profile evhacks-org
```

**Fallback (always available):** deterministic Python function in the Django view computing demand score from the same inputs. Ship this on minute one as the default — wire SageMaker behind a feature flag (`USE_SAGEMAKER=true`). If SCP blocks SageMaker or the model isn't ready, you lose nothing.

---

## Phase 7 — Frontend: Amplify (45 min)

Connect Amplify console app to GitHub `EV-Hacks/frontend`, `main` branch, auto-deploy.

> **Org check:** Amplify needs a service role with `iam:PassRole` — some restrictive orgs block this. If Amplify console gives a permissions error, fall back to: build the React app locally, sync `dist/` to an S3 bucket, front it with CloudFront. ~30 min extra.

Build settings: Node 20, `npm ci && npm run build`, output `dist/`.
Env vars: `VITE_API_BASE`, `VITE_COGNITO_DOMAIN`, `VITE_COGNITO_CLIENT_ID`, `VITE_MAPBOX_TOKEN`.

**Verify**
```bash
curl -I https://main.<app-id>.amplifyapp.com/
```

---

## Phase 8 — Observability (30 min)

Stack: `EvhObsStack`

- CloudWatch dashboard `EvhDemo` — API GW 4xx/5xx, Kinesis IncomingRecords, Firehose deliveries, Lambda errors, ECS CPU/mem, RDS connections, ALB target 5xx
- Four alarms → SNS topic `evh-alerts` → email subscription:
  - API GW 5xx > 5 in 5 min
  - Lambda `ingest_lambda` errors > 3 in 5 min
  - RDS CPU > 80% for 10 min
  - ECS service `RunningTaskCount` < 1

> **Org will already be sending CloudTrail to a central log archive account.** Don't bother setting up your own CloudTrail trail — would just duplicate. Focus on CloudWatch Logs + Metrics for *your* services.

**Verify**
```bash
aws cloudwatch describe-alarms --alarm-name-prefix evh- --profile evhacks-org \
  --query 'MetricAlarms[].{name:AlarmName,state:StateValue}'
```

---

## Phase 9 — End-to-end smoke + light load (60 min)

By hour ~7, everything deployed. Gauntlet:

1. **Cold path:** sign in as `demo-investor` → API → DB → demand score → response < 1s
2. **Hot path:** `python scripts/seed_pings.py --count 5000 --rate 50/s`
   - API GW p95 < 300ms
   - Kinesis IncomingRecords ~50/s
   - Firehose delivers within 60s
   - PostGIS rows reach 5000 within 90s
3. **Failure rehearsal:** stop one ECS task → alarm fires → ALB routes around → new task < 60s
4. **Demo flow rehearsal:** click the 3-min judge script while watching dashboard. Anything red → fix before 8 PM.

---

## Phase 10 — Demo-day safety net

- Pre-warm everything 30 min before demo: hit every endpoint, force SageMaker out of cold start, refresh Amplify cache.
- **Record a successful demo run** as backup video.
- Teardown script ready, **but do not run before submission post**.

---

## Cost — likely $0 to you

Inside an org, the **organizer pays the bill**. Your spend goes against their pool. That means:
- Don't be reckless (NAT Gateway runs even idle; ml.t2.medium does too)
- But also don't fight to save $2 if it costs you 30 min — your time is the bottleneck
- Tear down within 24h of submission as a courtesy

If the org gave you a credit cap, your phase 0a recon told you that. Plan around it.

---

## Org-member quick reference

| Concern | What changes |
|---|---|
| Region | Use whatever SCPs allow. Don't fight it. |
| Tagging | Bake mandatory tags into `app.py` once. Every resource gets them automatically. |
| IAM users | Forbidden in most orgs — use IAM Identity Center for humans, IAM roles for compute. |
| CDK bootstrap | May already be done. Try `cdk bootstrap`, fall back to asking organizer for their template. |
| S3 public access | Always `BLOCK_ALL` + SSL enforced — non-negotiable in most orgs. |
| Service availability | Some services SCP'd off (SageMaker is the common one). Probe before designing around it. |
| CloudTrail | Already centralized — don't add your own trail. |
| Billing alarm | Org budget supersedes yours. Just don't be wasteful. |
| Teardown | `cdk destroy --all --force` within 24h of submission. |

---

## Suggested CDK stack layout

```
infra/
├── app.py                   # mandatory tags applied here
├── stacks/
│   ├── network_stack.py     # VPC, SGs, Secrets shells
│   ├── data_stack.py        # RDS, Redis, S3 (with org-safe S3 defaults)
│   ├── auth_stack.py        # Cognito
│   ├── ingest_stack.py      # API GW, Lambda, Kinesis, Firehose
│   ├── app_stack.py         # ECR, ECS, ALB
│   ├── ml_stack.py          # SageMaker (only deploy if Phase 0a recon allows)
│   └── obs_stack.py         # CloudWatch dashboard + alarms
└── scripts/
    ├── seed_pings.py        # Synthetic mobility data generator
    ├── psql_bastion.sh      # SSM port-forward to RDS
    └── destroy.sh           # cdk destroy --all
```

Deploy order:
```bash
cdk deploy EvhNetworkStack EvhDataStack EvhAuthStack EvhIngestStack EvhAppStack EvhMlStack EvhObsStack
```

Each stack exports IDs via `CfnOutput`; downstream stacks consume via shared construct refs in `app.py`.
