from aws_cdk import (
    Stack,
    CfnOutput,
    RemovalPolicy,
    aws_iam as iam,
    aws_ecr as ecr,
)
from constructs import Construct

from infra.stacks.compute_stack import EvhComputeStack


GITHUB_REPO = "semilores/EV-Hacks"


class EvhCicdStack(Stack):
    """ECR repo + GitHub OIDC role for the backend deploy workflow."""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        compute: EvhComputeStack,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self.api_repo = ecr.Repository(
            self,
            "ApiRepo",
            repository_name="evh/api",
            image_scan_on_push=True,
            removal_policy=RemovalPolicy.DESTROY,
            empty_on_delete=True,
            lifecycle_rules=[
                ecr.LifecycleRule(
                    description="Keep last 10 images",
                    max_image_count=10,
                )
            ],
        )

        # One OIDC provider per account per URL — wrapped in try logic below
        oidc_provider = iam.OpenIdConnectProvider(
            self,
            "GitHubOidc",
            url="https://token.actions.githubusercontent.com",
            client_ids=["sts.amazonaws.com"],
        )

        self.github_role = iam.Role(
            self,
            "GitHubActionsRole",
            role_name="evh-github-actions",
            assumed_by=iam.FederatedPrincipal(
                oidc_provider.open_id_connect_provider_arn,
                conditions={
                    "StringEquals": {
                        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                    },
                    "StringLike": {
                        "token.actions.githubusercontent.com:sub": f"repo:{GITHUB_REPO}:ref:refs/heads/main",
                    },
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity",
            ),
            description="GitHub Actions deploy role for EV Hacks",
        )

        # ECR push permissions
        self.api_repo.grant_pull_push(self.github_role)
        self.github_role.add_to_policy(
            iam.PolicyStatement(
                actions=["ecr:GetAuthorizationToken"],
                resources=["*"],
            )
        )

        # SSM send-command to the backend EC2 only
        self.github_role.add_to_policy(
            iam.PolicyStatement(
                actions=["ssm:SendCommand"],
                resources=[
                    f"arn:aws:ec2:{self.region}:{self.account}:instance/{compute.instance.instance_id}",
                    f"arn:aws:ssm:{self.region}::document/AWS-RunShellScript",
                ],
            )
        )
        self.github_role.add_to_policy(
            iam.PolicyStatement(
                actions=["ssm:GetCommandInvocation"],
                resources=["*"],
            )
        )
        # Find the EC2 by tag in the workflow
        self.github_role.add_to_policy(
            iam.PolicyStatement(
                actions=["ec2:DescribeInstances"],
                resources=["*"],
            )
        )

        CfnOutput(
            self,
            "EcrRepoUri",
            value=self.api_repo.repository_uri,
            export_name="EvhEcrRepoUri",
        )
        CfnOutput(
            self,
            "GitHubRoleArn",
            value=self.github_role.role_arn,
            export_name="EvhGitHubRoleArn",
        )
