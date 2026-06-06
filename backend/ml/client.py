import json
import logging

logger = logging.getLogger(__name__)

# Features expected by the model (in order):
# [lat, lng, poi_count, station_count, ev_traffic]
# Returns demand_score float 0–100, or None if unavailable.


def predict_demand_score(lat: float, lng: float, poi_count: int = 0,
                         station_count: int = 0, ev_traffic: float = 0.5) -> float | None:
    from django.conf import settings

    if not getattr(settings, "USE_SAGEMAKER", False):
        return None

    endpoint = getattr(settings, "SAGEMAKER_ENDPOINT_NAME", "")
    if not endpoint:
        return None

    try:
        import boto3

        client = boto3.client(
            "sagemaker-runtime",
            region_name=getattr(settings, "AWS_DEFAULT_REGION", "eu-west-1"),
            aws_access_key_id=getattr(settings, "AWS_ACCESS_KEY_ID", None) or None,
            aws_secret_access_key=getattr(settings, "AWS_SECRET_ACCESS_KEY", None) or None,
            aws_session_token=getattr(settings, "AWS_SESSION_TOKEN", None) or None,
        )

        payload = json.dumps({"instances": [[lat, lng, poi_count, station_count, ev_traffic]]})
        response = client.invoke_endpoint(
            EndpointName=endpoint,
            ContentType="application/json",
            Body=payload,
        )
        result = json.loads(response["Body"].read())
        score = result.get("predictions", [None])[0]
        if score is not None:
            return round(max(0.0, min(100.0, float(score))), 2)
        return None
    except Exception as exc:
        logger.warning("SageMaker call failed (%s) — falling back to request value", exc)
        return None
