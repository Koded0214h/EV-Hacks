"""
SageMaker sklearn container inference script.
Packaged inside model.tar.gz alongside model.pkl.
"""
import json
import os
import numpy as np


def model_fn(model_dir):
    import joblib
    return joblib.load(os.path.join(model_dir, "model.pkl"))


def input_fn(request_body, content_type):
    if content_type == "application/json":
        data = json.loads(request_body)
        return np.array(data["instances"], dtype=float)
    raise ValueError(f"Unsupported content type: {content_type}")


def predict_fn(input_data, model):
    return model.predict(input_data)


def output_fn(prediction, accept):
    return json.dumps({"predictions": prediction.tolist()}), "application/json"
