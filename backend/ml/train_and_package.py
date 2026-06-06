"""
Run once locally to create model.tar.gz, then upload to S3.

Usage:
  cd backend
  python -m ml.train_and_package

Output:
  ml/model.tar.gz  → upload this to:
  s3://evh-data-487054650567-eu-west-1/ml/models/v1/model.tar.gz
"""
import os
import tarfile
import shutil
import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

# ── Training data from STUB_ZONES ─────────────────────────────
# Features: [lat, lng, poi_count, station_count, ev_traffic]
TRAINING_DATA = [
    # lat,    lng,    poi,  stations, ev_traffic, demand_score
    [6.4250, 3.4100,  428,  2,        0.91,       91.2],
    [6.4281, 3.4650,  312,  2,        0.78,       87.4],
    [6.4550, 3.3900,  587,  0,        0.82,       82.6],
    [6.4600, 3.4500,  244,  1,        0.68,       76.8],
    [6.5059, 3.3742,  521,  1,        0.61,       74.1],
    [6.4400, 3.5350,  198,  0,        0.55,       65.3],
    [6.4550, 3.4950,  156,  0,        0.52,       63.7],
    [6.5944, 3.3408,  210,  1,        0.48,       61.3],
    [6.5400, 3.3800,  148,  0,        0.45,       58.9],
    [6.4679, 3.5990,   78,  1,        0.44,       58.4],
    [6.4480, 3.3625,   64,  0,        0.38,       54.2],
    [6.3900, 3.6200,   92,  0,        0.36,       53.8],
    [6.6018, 3.3515,   88,  0,        0.33,       49.7],
    [6.5508, 3.3820,   74,  0,        0.31,       48.2],
    [6.4924, 3.3554,   92,  0,        0.29,       43.9],
    [6.5600, 3.3500,   58,  0,        0.25,       38.7],
    [6.4680, 3.2850,   48,  0,        0.22,       37.4],
    [6.6100, 3.3900,   42,  0,        0.19,       35.8],
    [6.5100, 3.3400,   38,  0,        0.16,       33.2],
    [6.4700, 3.3200,   34,  0,        0.14,       32.6],
    [6.6200, 3.3100,   29,  0,        0.11,       29.1],
    [6.4350, 3.2800,   24,  0,        0.08,       24.7],
]

data = np.array(TRAINING_DATA)
X = data[:, :5]   # features
y = data[:, 5]    # demand_score

# Add noise-augmented copies to prevent overfitting on 22 samples
rng = np.random.default_rng(42)
n = len(X)
noise = rng.normal(0, 0.02, (n * 4, X.shape[1]))
X_aug = np.vstack([X, X * (1 + noise[:n]), X * (1 + noise[n:2*n]), X * (1 + noise[2*n:3*n]), X * (1 + noise[3*n:])])
y_aug = np.tile(y, 5)

model = Pipeline([
    ("scaler", StandardScaler()),
    ("rf", RandomForestRegressor(n_estimators=200, max_depth=6, random_state=42)),
])
model.fit(X_aug, y_aug)

# Quick sanity check
preds = model.predict(X)
errors = np.abs(preds - y)
print(f"Training MAE: {errors.mean():.2f}  Max: {errors.max():.2f}")

# ── Package ─────────────────────────────────────────────────────
BUILD_DIR = os.path.join(os.path.dirname(__file__), "_build")
os.makedirs(BUILD_DIR, exist_ok=True)

joblib.dump(model, os.path.join(BUILD_DIR, "model.pkl"))
shutil.copy(os.path.join(os.path.dirname(__file__), "inference.py"), BUILD_DIR)

OUT = os.path.join(os.path.dirname(__file__), "model.tar.gz")
with tarfile.open(OUT, "w:gz") as tar:
    tar.add(os.path.join(BUILD_DIR, "model.pkl"),    arcname="model.pkl")
    tar.add(os.path.join(BUILD_DIR, "inference.py"), arcname="inference.py")

shutil.rmtree(BUILD_DIR)
print(f"\nCreated: {OUT}")
print("\nNext steps:")
print("  1. Open the S3 console and navigate to:")
print("     s3://evh-data-487054650567-eu-west-1/ml/models/v1/")
print("  2. Upload ml/model.tar.gz")
print("  3. Follow the SageMaker console steps in the README")
