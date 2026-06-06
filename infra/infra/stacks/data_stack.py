from aws_cdk import (
    Stack,
    CfnOutput,
    Duration,
    RemovalPolicy,
    aws_ec2 as ec2,
    aws_rds as rds,
    aws_s3 as s3,
)
from constructs import Construct

from infra.stacks.network_stack import EvhNetworkStack


class EvhDataStack(Stack):
    """RDS Postgres + PostGIS and S3 buckets. Redis runs in docker-compose on the backend host."""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        network: EvhNetworkStack,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self.db = rds.DatabaseInstance(
            self,
            "EvhRds",
            engine=rds.DatabaseInstanceEngine.postgres(
                version=rds.PostgresEngineVersion.of("16.14", "16")
            ),
            instance_type=ec2.InstanceType.of(
                ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MICRO
            ),
            credentials=rds.Credentials.from_generated_secret(
                "evhmaster", secret_name="evh/db/master"
            ),
            vpc=network.vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[network.sg_rds],
            allocated_storage=20,
            max_allocated_storage=50,
            storage_type=rds.StorageType.GP3,
            multi_az=False,
            publicly_accessible=False,
            database_name="evh",
            backup_retention=Duration.days(0),
            deletion_protection=False,
            removal_policy=RemovalPolicy.DESTROY,
            cloudwatch_logs_exports=["postgresql"],
        )

        self.data_bucket = s3.Bucket(
            self,
            "DataBucket",
            bucket_name=f"evh-data-{self.account}-{self.region}",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            versioned=True,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            lifecycle_rules=[
                s3.LifecycleRule(
                    id="raw-to-ia",
                    prefix="raw/",
                    transitions=[
                        s3.Transition(
                            storage_class=s3.StorageClass.INFREQUENT_ACCESS,
                            transition_after=Duration.days(30),
                        )
                    ],
                )
            ],
        )

        self.frontend_assets_bucket = s3.Bucket(
            self,
            "FrontendAssetsBucket",
            bucket_name=f"evh-frontend-assets-{self.account}-{self.region}",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        CfnOutput(
            self,
            "DbSecretArn",
            value=self.db.secret.secret_arn,
            export_name="EvhDbSecretArn",
        )
        CfnOutput(
            self,
            "DbEndpoint",
            value=self.db.db_instance_endpoint_address,
            export_name="EvhDbEndpoint",
        )
        CfnOutput(
            self,
            "DbPort",
            value=self.db.db_instance_endpoint_port,
            export_name="EvhDbPort",
        )
        CfnOutput(
            self,
            "DataBucketName",
            value=self.data_bucket.bucket_name,
            export_name="EvhDataBucketName",
        )
        CfnOutput(
            self,
            "DataBucketArn",
            value=self.data_bucket.bucket_arn,
            export_name="EvhDataBucketArn",
        )
        CfnOutput(
            self,
            "FrontendAssetsBucketName",
            value=self.frontend_assets_bucket.bucket_name,
            export_name="EvhFrontendAssetsBucketName",
        )
