from aws_cdk import (
    Stack,
    CfnOutput,
    aws_ec2 as ec2,
    aws_iam as iam,
)
from constructs import Construct

from infra.stacks.network_stack import EvhNetworkStack
from infra.stacks.data_stack import EvhDataStack
from infra.stacks.auth_stack import EvhAuthStack
from infra.stacks.ingest_stack import EvhIngestStack


BOOTSTRAP_SCRIPT = '''#!/bin/bash
# /opt/evhacks/bootstrap.sh
# Run this on the EC2 host AFTER `git clone`-ing the backend into /opt/evhacks/app.
# CI/CD calls this same script on every deploy.
set -e
source /etc/profile.d/evhacks.sh
cd /opt/evhacks/app

DB_PW=$(aws secretsmanager get-secret-value --secret-id "$DB_SECRET_ARN" \\
  --query SecretString --output text | jq -r .password)
DJANGO_KEY=$(aws secretsmanager get-secret-value --secret-id "$DJANGO_SECRET_ARN" \\
  --query SecretString --output text)

# Single .env consumed by docker-compose. No override file needed —
# docker-compose.yml has profiles=["local"] on the db service so it stays off in production.
cat > .env <<EOF
SECRET_KEY=$DJANGO_KEY
DEBUG=False
ALLOWED_HOSTS=*

DB_NAME=evh
DB_USER=evhmaster
DB_PASSWORD=$DB_PW
DB_HOST=$DB_HOST
DB_PORT=5432

REDIS_URL=redis://redis:6379/0

AWS_REGION=$AWS_REGION
AWS_S3_BUCKET=$DATA_BUCKET
AWS_S3_ASSETS_BUCKET=$ASSETS_BUCKET

COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
COGNITO_PWA_CLIENT_ID=$COGNITO_PWA_CLIENT_ID
COGNITO_API_CLIENT_ID=$COGNITO_API_CLIENT_ID
COGNITO_TOKEN_ISSUER=$COGNITO_TOKEN_ISSUER

KINESIS_STREAM_NAME=evh-pings
INGEST_API_URL=$INGEST_API_URL

ECR_REGISTRY=$ECR_REGISTRY/evh
IMAGE_TAG=latest
EOF

# ECR login (token valid 12h — CI/CD re-runs this each deploy)
aws ecr get-login-password --region "$AWS_REGION" \\
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

docker compose pull
docker compose up -d
docker compose ps
'''


class EvhComputeStack(Stack):
    """Single EC2 host running the Django + Redis + Celery stack via docker-compose."""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        network: EvhNetworkStack,
        data: EvhDataStack,
        auth: EvhAuthStack,
        ingest: EvhIngestStack,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        sg_app = ec2.SecurityGroup(
            self,
            "AppSg",
            vpc=network.vpc,
            description="EVH app host public ingress",
            allow_all_outbound=True,
        )
        sg_app.add_ingress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(80), "HTTP")
        sg_app.add_ingress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(8000), "Django direct")

        role = iam.Role(
            self,
            "AppRole",
            assumed_by=iam.ServicePrincipal("ec2.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name("AmazonSSMManagedInstanceCore"),
                iam.ManagedPolicy.from_aws_managed_policy_name("CloudWatchAgentServerPolicy"),
                iam.ManagedPolicy.from_aws_managed_policy_name("AmazonEC2ContainerRegistryReadOnly"),
            ],
        )
        data.data_bucket.grant_read_write(role)
        data.db.secret.grant_read(role)
        network.django_secret.grant_read(role)

        user_data = ec2.UserData.for_linux()
        user_data.add_commands(
            "set -ex",
            "dnf update -y",
            "dnf install -y docker git jq postgresql15",
            "systemctl enable --now docker",
            "usermod -a -G docker ec2-user",
            "mkdir -p /usr/local/lib/docker/cli-plugins",
            "curl -SL https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-linux-x86_64 "
            "-o /usr/local/lib/docker/cli-plugins/docker-compose",
            "chmod +x /usr/local/lib/docker/cli-plugins/docker-compose",
            "mkdir -p /opt/evhacks",
            "chown ec2-user:ec2-user /opt/evhacks",
            # Persist runtime context for whoever SSHes in next
            f"cat > /etc/profile.d/evhacks.sh <<'EOF'\n"
            f"export DATA_BUCKET={data.data_bucket.bucket_name}\n"
            f"export ASSETS_BUCKET={data.frontend_assets_bucket.bucket_name}\n"
            f"export DB_HOST={data.db.db_instance_endpoint_address}\n"
            f"export DB_SECRET_ARN={data.db.secret.secret_arn}\n"
            f"export DJANGO_SECRET_ARN={network.django_secret.secret_arn}\n"
            f"export AWS_REGION={self.region}\n"
            f"export ECR_REGISTRY={self.account}.dkr.ecr.{self.region}.amazonaws.com\n"
            f"export COGNITO_USER_POOL_ID={auth.user_pool.user_pool_id}\n"
            f"export COGNITO_PWA_CLIENT_ID={auth.pwa_client.user_pool_client_id}\n"
            f"export COGNITO_API_CLIENT_ID={auth.api_client.user_pool_client_id}\n"
            f"export COGNITO_TOKEN_ISSUER=https://cognito-idp.{self.region}.amazonaws.com/{auth.user_pool.user_pool_id}\n"
            f"export INGEST_API_URL={ingest.api.api_endpoint}/ingest\n"
            "EOF",
            "chmod +x /etc/profile.d/evhacks.sh",
            # Drop the bootstrap script
            f"cat > /opt/evhacks/bootstrap.sh <<'EVHACKS_EOF'\n{BOOTSTRAP_SCRIPT}\nEVHACKS_EOF",
            "chmod +x /opt/evhacks/bootstrap.sh",
            "chown ec2-user:ec2-user /opt/evhacks/bootstrap.sh",
            "echo 'EVH_READY' > /opt/evhacks/STATUS",
        )

        self.instance = ec2.Instance(
            self,
            "AppHost",
            instance_name="evh-app",
            instance_type=ec2.InstanceType.of(
                ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.SMALL
            ),
            machine_image=ec2.MachineImage.latest_amazon_linux2023(),
            vpc=network.vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PUBLIC),
            security_group=sg_app,
            role=role,
            user_data=user_data,
            block_devices=[
                ec2.BlockDevice(
                    device_name="/dev/xvda",
                    volume=ec2.BlockDeviceVolume.ebs(
                        20, volume_type=ec2.EbsDeviceVolumeType.GP3, delete_on_termination=True
                    ),
                )
            ],
        )
        # Add the existing ECS-tier SG so the EC2 inherits RDS access (5432 ECS -> RDS already permitted)
        self.instance.add_security_group(network.sg_ecs)

        eip = ec2.CfnEIP(self, "AppEip", domain="vpc")
        ec2.CfnEIPAssociation(
            self,
            "AppEipAssoc",
            eip=eip.ref,
            instance_id=self.instance.instance_id,
        )

        CfnOutput(self, "Ec2InstanceId", value=self.instance.instance_id, export_name="EvhEc2InstanceId")
        CfnOutput(self, "Ec2PublicIp", value=eip.attr_public_ip, export_name="EvhEc2PublicIp")
        CfnOutput(
            self,
            "BackendUrl",
            value=f"http://{eip.attr_public_ip}",
            export_name="EvhBackendUrl",
        )
        CfnOutput(
            self,
            "SsmStartCmd",
            value=f"aws ssm start-session --target {self.instance.instance_id}",
            export_name="EvhSsmStartCmd",
        )
