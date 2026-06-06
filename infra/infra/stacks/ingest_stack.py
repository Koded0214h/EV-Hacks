from aws_cdk import (
    Stack,
    CfnOutput,
    Duration,
    RemovalPolicy,
    aws_iam as iam,
    aws_lambda as lambda_,
    aws_logs as logs,
    aws_kinesis as kinesis,
    aws_kinesisfirehose as firehose,
    aws_apigatewayv2 as apigwv2,
    aws_apigatewayv2_integrations as apigwv2_integrations,
)
from constructs import Construct

from infra.stacks.data_stack import EvhDataStack


INGEST_LAMBDA_CODE = '''
import json
import os
import uuid
import boto3

kinesis = boto3.client("kinesis")
STREAM = os.environ["STREAM_NAME"]

REQUIRED = ("lat", "lon", "ts")


def handler(event, _context):
    try:
        body = event.get("body") or "{}"
        if event.get("isBase64Encoded"):
            import base64
            body = base64.b64decode(body).decode()
        payload = json.loads(body)
    except Exception as e:
        return {"statusCode": 400, "body": json.dumps({"error": f"bad json: {e}"})}

    missing = [f for f in REQUIRED if f not in payload]
    if missing:
        return {"statusCode": 400, "body": json.dumps({"error": f"missing: {missing}"})}

    # Anonymise — never propagate raw driver identity past this point
    raw_id = str(payload.pop("driver_id", uuid.uuid4().hex))
    partition_key = raw_id

    record = {
        "lat": float(payload["lat"]),
        "lon": float(payload["lon"]),
        "ts": payload["ts"],
        "speed": payload.get("speed"),
        "battery": payload.get("battery"),
        "kind": payload.get("kind", "ping"),
        "ingested_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }

    kinesis.put_record(
        StreamName=STREAM,
        Data=(json.dumps(record) + "\\n").encode(),
        PartitionKey=partition_key,
    )
    return {"statusCode": 200, "body": json.dumps({"ok": True})}
'''


class EvhIngestStack(Stack):
    """API Gateway -> Lambda -> Kinesis -> Firehose -> S3."""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        data: EvhDataStack,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self.stream = kinesis.Stream(
            self,
            "PingStream",
            stream_name="evh-pings",
            stream_mode=kinesis.StreamMode.ON_DEMAND,
            retention_period=Duration.hours(24),
            removal_policy=RemovalPolicy.DESTROY,
        )

        self.ingest_fn = lambda_.Function(
            self,
            "IngestFn",
            function_name="evh-ingest",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="index.handler",
            code=lambda_.Code.from_inline(INGEST_LAMBDA_CODE),
            timeout=Duration.seconds(5),
            memory_size=256,
            environment={"STREAM_NAME": self.stream.stream_name},
            log_retention=logs.RetentionDays.ONE_WEEK,
        )
        self.stream.grant_write(self.ingest_fn)

        # Firehose -> S3
        firehose_role = iam.Role(
            self,
            "FirehoseRole",
            assumed_by=iam.ServicePrincipal("firehose.amazonaws.com"),
        )
        firehose_policy = iam.Policy(
            self,
            "FirehosePolicy",
            statements=[
                iam.PolicyStatement(
                    actions=[
                        "kinesis:DescribeStream",
                        "kinesis:DescribeStreamSummary",
                        "kinesis:GetShardIterator",
                        "kinesis:GetRecords",
                        "kinesis:ListShards",
                    ],
                    resources=[self.stream.stream_arn],
                ),
                iam.PolicyStatement(
                    actions=[
                        "s3:AbortMultipartUpload",
                        "s3:GetBucketLocation",
                        "s3:GetObject",
                        "s3:ListBucket",
                        "s3:ListBucketMultipartUploads",
                        "s3:PutObject",
                    ],
                    resources=[
                        data.data_bucket.bucket_arn,
                        f"{data.data_bucket.bucket_arn}/*",
                    ],
                ),
                iam.PolicyStatement(
                    actions=["logs:PutLogEvents", "logs:CreateLogStream"],
                    resources=["*"],
                ),
            ],
        )
        firehose_role.attach_inline_policy(firehose_policy)

        self.delivery_stream = firehose.CfnDeliveryStream(
            self,
            "PingFirehose",
            delivery_stream_name="evh-pings-firehose",
            delivery_stream_type="KinesisStreamAsSource",
            kinesis_stream_source_configuration=firehose.CfnDeliveryStream.KinesisStreamSourceConfigurationProperty(
                kinesis_stream_arn=self.stream.stream_arn,
                role_arn=firehose_role.role_arn,
            ),
            extended_s3_destination_configuration=firehose.CfnDeliveryStream.ExtendedS3DestinationConfigurationProperty(
                bucket_arn=data.data_bucket.bucket_arn,
                role_arn=firehose_role.role_arn,
                prefix="raw/pings/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/",
                error_output_prefix="raw/pings_errors/!{firehose:error-output-type}/",
                buffering_hints=firehose.CfnDeliveryStream.BufferingHintsProperty(
                    interval_in_seconds=60,
                    size_in_m_bs=5,
                ),
                compression_format="GZIP",
                cloud_watch_logging_options=firehose.CfnDeliveryStream.CloudWatchLoggingOptionsProperty(
                    enabled=True,
                    log_group_name="/aws/kinesisfirehose/evh-pings",
                    log_stream_name="S3Delivery",
                ),
            ),
        )
        self.delivery_stream.node.add_dependency(firehose_policy)

        self.api = apigwv2.HttpApi(
            self,
            "IngestApi",
            api_name="evh-ingest",
            cors_preflight=apigwv2.CorsPreflightOptions(
                allow_origins=["*"],
                allow_methods=[apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.OPTIONS],
                allow_headers=["authorization", "content-type"],
            ),
        )

        self.api.add_routes(
            path="/ingest",
            methods=[apigwv2.HttpMethod.POST],
            integration=apigwv2_integrations.HttpLambdaIntegration("LambdaInt", self.ingest_fn),
        )

        # Health route — unauthenticated, for monitoring
        health_fn = lambda_.Function(
            self,
            "HealthFn",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="index.handler",
            code=lambda_.Code.from_inline(
                'def handler(e,c): return {"statusCode":200,"body":"ok"}'
            ),
            timeout=Duration.seconds(3),
            log_retention=logs.RetentionDays.ONE_WEEK,
        )
        self.api.add_routes(
            path="/health",
            methods=[apigwv2.HttpMethod.GET],
            integration=apigwv2_integrations.HttpLambdaIntegration("HealthInt", health_fn),
        )

        CfnOutput(self, "IngestUrl", value=f"{self.api.api_endpoint}/ingest", export_name="EvhIngestUrl")
        CfnOutput(self, "HealthUrl", value=f"{self.api.api_endpoint}/health", export_name="EvhHealthUrl")
        CfnOutput(self, "StreamName", value=self.stream.stream_name, export_name="EvhStreamName")
        CfnOutput(self, "StreamArn", value=self.stream.stream_arn, export_name="EvhStreamArn")
        CfnOutput(self, "FirehoseName", value=self.delivery_stream.delivery_stream_name or "", export_name="EvhFirehoseName")
