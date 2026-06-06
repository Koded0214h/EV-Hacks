from aws_cdk import (
    Stack,
    CfnOutput,
    aws_ec2 as ec2,
    aws_secretsmanager as secretsmanager,
)
from constructs import Construct


class EvhNetworkStack(Stack):
    """VPC, security groups, and shared secrets for EV Hacks."""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self.vpc = ec2.Vpc(
            self,
            "EvhVpc",
            vpc_name="EvhVpc",
            max_azs=2,
            nat_gateways=1,
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="public",
                    subnet_type=ec2.SubnetType.PUBLIC,
                    cidr_mask=24,
                ),
                ec2.SubnetConfiguration(
                    name="private-egress",
                    subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidr_mask=24,
                ),
                ec2.SubnetConfiguration(
                    name="private-isolated",
                    subnet_type=ec2.SubnetType.PRIVATE_ISOLATED,
                    cidr_mask=24,
                ),
            ],
        )

        self.sg_alb = ec2.SecurityGroup(
            self, "AlbSg", vpc=self.vpc, description="ALB ingress (443/80)", allow_all_outbound=True
        )
        self.sg_alb.add_ingress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(80), "HTTP from anywhere")
        self.sg_alb.add_ingress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(443), "HTTPS from anywhere")

        self.sg_ecs = ec2.SecurityGroup(
            self, "EcsSg", vpc=self.vpc, description="ECS tasks", allow_all_outbound=True
        )
        self.sg_ecs.add_ingress_rule(self.sg_alb, ec2.Port.tcp(8000), "ALB to Django")

        self.sg_lambda = ec2.SecurityGroup(
            self, "LambdaSg", vpc=self.vpc, description="Lambda functions", allow_all_outbound=True
        )

        self.sg_rds = ec2.SecurityGroup(
            self, "RdsSg", vpc=self.vpc, description="RDS Postgres", allow_all_outbound=False
        )
        self.sg_rds.add_ingress_rule(self.sg_ecs, ec2.Port.tcp(5432), "ECS to Postgres")
        self.sg_rds.add_ingress_rule(self.sg_lambda, ec2.Port.tcp(5432), "Lambda to Postgres")

        self.sg_redis = ec2.SecurityGroup(
            self, "RedisSg", vpc=self.vpc, description="ElastiCache Redis", allow_all_outbound=False
        )
        self.sg_redis.add_ingress_rule(self.sg_ecs, ec2.Port.tcp(6379), "ECS to Redis")
        self.sg_redis.add_ingress_rule(self.sg_lambda, ec2.Port.tcp(6379), "Lambda to Redis")

        self.django_secret = secretsmanager.Secret(
            self,
            "DjangoSecretKey",
            secret_name="evh/django/secret_key",
            description="Django SECRET_KEY",
            generate_secret_string=secretsmanager.SecretStringGenerator(
                exclude_characters='/@" \\\'',
                password_length=50,
            ),
        )

        CfnOutput(self, "VpcId", value=self.vpc.vpc_id, export_name="EvhVpcId")
        CfnOutput(self, "DjangoSecretArn", value=self.django_secret.secret_arn, export_name="EvhDjangoSecretArn")
        CfnOutput(self, "AlbSgId", value=self.sg_alb.security_group_id, export_name="EvhAlbSgId")
        CfnOutput(self, "EcsSgId", value=self.sg_ecs.security_group_id, export_name="EvhEcsSgId")
        CfnOutput(self, "LambdaSgId", value=self.sg_lambda.security_group_id, export_name="EvhLambdaSgId")
        CfnOutput(self, "RdsSgId", value=self.sg_rds.security_group_id, export_name="EvhRdsSgId")
        CfnOutput(self, "RedisSgId", value=self.sg_redis.security_group_id, export_name="EvhRedisSgId")
