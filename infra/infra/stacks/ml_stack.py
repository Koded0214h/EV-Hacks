from aws_cdk import (
    Stack,
    CfnOutput,
    aws_iam as iam,
    aws_sagemaker as sagemaker,
)
from constructs import Construct


# SageMaker-managed sklearn 1.2-1 CPU inference image for eu-west-1
SKLEARN_IMAGE_URI = (
    "141502667606.dkr.ecr.eu-west-1.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3"
)


class EvhMlStack(Stack):
    """SageMaker real-time endpoint for demand scoring.

    Assumes the model artifact has been uploaded to:
      s3://evh-data-<acct>-<region>/ml/models/v1/model.tar.gz
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        data_bucket_name: str,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        model_data_url = f"s3://{data_bucket_name}/ml/models/v1/model.tar.gz"

        # SageMaker execution role with read access to the data bucket
        self.role = iam.Role(
            self,
            "SageMakerExecutionRole",
            role_name="SageMakerExecutionRole",
            assumed_by=iam.ServicePrincipal("sagemaker.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name("AmazonSageMakerFullAccess"),
            ],
            inline_policies={
                "EvhDataBucketRead": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            actions=["s3:GetObject", "s3:ListBucket"],
                            resources=[
                                f"arn:aws:s3:::{data_bucket_name}",
                                f"arn:aws:s3:::{data_bucket_name}/*",
                            ],
                        )
                    ]
                )
            },
        )

        self.model = sagemaker.CfnModel(
            self,
            "DemandModel",
            model_name="evh-demand-v1",
            execution_role_arn=self.role.role_arn,
            primary_container=sagemaker.CfnModel.ContainerDefinitionProperty(
                image=SKLEARN_IMAGE_URI,
                model_data_url=model_data_url,
                environment={
                    "SAGEMAKER_PROGRAM": "inference.py",
                    "SAGEMAKER_SUBMIT_DIRECTORY": "/opt/ml/model/code",
                },
            ),
        )

        self.endpoint_config = sagemaker.CfnEndpointConfig(
            self,
            "DemandConfig",
            endpoint_config_name="evh-demand-config",
            production_variants=[
                sagemaker.CfnEndpointConfig.ProductionVariantProperty(
                    variant_name="default",
                    model_name=self.model.model_name,
                    initial_instance_count=1,
                    instance_type="ml.t2.medium",
                    initial_variant_weight=1.0,
                )
            ],
        )
        self.endpoint_config.add_dependency(self.model)

        self.endpoint = sagemaker.CfnEndpoint(
            self,
            "DemandEndpoint",
            endpoint_name="evh-demand-v1",
            endpoint_config_name=self.endpoint_config.endpoint_config_name,
        )
        self.endpoint.add_dependency(self.endpoint_config)

        CfnOutput(
            self,
            "EndpointName",
            value=self.endpoint.endpoint_name,
            export_name="EvhDemandEndpoint",
        )
        CfnOutput(
            self,
            "ModelDataUrl",
            value=model_data_url,
            export_name="EvhDemandModelDataUrl",
        )
