# ML Demand Scoring

## What it does

The ML model predicts a **demand score (0–100)** for any geographic point based on:

| Feature | Description |
|---|---|
| `lat` | Latitude |
| `lng` | Longitude |
| `poi_count` | Points of interest within ~2km |
| `station_count` | Existing charging stations nearby |
| `ev_traffic` | Estimated EV traffic (0–1 normalised) |

Output: float 0–100 representing EV charging demand at that location.

---

## Architecture

```
Request → roi/views.py
              │
              ├─ USE_SAGEMAKER=True  → ml/client.py → SageMaker invoke_endpoint
              │                                         → float score
              │
              └─ USE_SAGEMAKER=False → deterministic formula in roi/calculator.py
                                       (demand_score from zone data)
```

The deterministic fallback is always used by default. SageMaker is an optional enhancement behind a feature flag.

---

## Model

**Type:** `sklearn.ensemble.RandomForestRegressor` (100 estimators)

**Training data:** 22 STUB_ZONES (Lagos area), noise-augmented 5× to 110 samples.

**Training:** `backend/ml/train_and_package.py`

```bash
cd backend
python ml/train_and_package.py
# Outputs: backend/ml/model.tar.gz
```

**MAE on training data:** ~0.08 (intentionally low — training on the same stubs the app uses)

---

## Enabling SageMaker

### 1. Upload model to S3

```bash
aws s3 cp backend/ml/model.tar.gz \
  s3://evh-data-487054650567-eu-west-1/ml/models/v1/model.tar.gz \
  --region eu-west-1
```

### 2. Create endpoint in AWS console

- Go to SageMaker → Models → Create model
- Framework: `sklearn 1.2-1`
- Model artifact: `s3://evh-data-487054650567-eu-west-1/ml/models/v1/model.tar.gz`
- Execution role: `SageMakerExecutionRole`
- Create endpoint config: 1 × `ml.t2.medium`
- Create endpoint: name it `evh-demand-v1`

### 3. Enable the flag

In `backend/.env` (or EC2's `.env`):

```env
USE_SAGEMAKER=True
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_DEFAULT_REGION=eu-west-1
SAGEMAKER_ENDPOINT_NAME=evh-demand-v1
```

### 4. Verify

```bash
aws sagemaker-runtime invoke-endpoint \
  --endpoint-name evh-demand-v1 \
  --content-type application/json \
  --body '{"instances":[[6.45, 3.40, 18, 3, 0.5]]}' \
  /tmp/out.json --region eu-west-1

cat /tmp/out.json
# Expected: {"predictions": [72.3]}
```

---

## Client code

`backend/ml/client.py`

```python
def predict_demand_score(lat, lng, poi_count=0, station_count=0, ev_traffic=0.5):
    """Returns float 0-100 or None if SageMaker unavailable/disabled."""
    if not getattr(settings, "USE_SAGEMAKER", False):
        return None
    # boto3 call → sagemaker-runtime invoke_endpoint
    # Returns float from model prediction
```

When `None` is returned, `roi/views.py` falls back to the zone's pre-calculated `demand_score`.

---

## Inference script

`backend/ml/inference.py` — SageMaker entry point loaded inside the container at inference time. Handles `model_fn` and `predict_fn` as required by the sklearn container.
