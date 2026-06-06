from aws_cdk import (
    Stack,
    CfnOutput,
    Duration,
    RemovalPolicy,
    aws_cognito as cognito,
)
from constructs import Construct


class EvhAuthStack(Stack):
    """Cognito user pool with driver/operator/investor groups."""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self.user_pool = cognito.UserPool(
            self,
            "EvhUserPool",
            user_pool_name="evh-users",
            self_sign_up_enabled=True,
            sign_in_aliases=cognito.SignInAliases(email=True, username=True),
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=True),
            ),
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_lowercase=True,
                require_uppercase=False,
                require_digits=True,
                require_symbols=False,
            ),
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            removal_policy=RemovalPolicy.DESTROY,
        )

        for group in ["drivers", "operators", "investors"]:
            cognito.CfnUserPoolGroup(
                self,
                f"Group{group.capitalize()}",
                user_pool_id=self.user_pool.user_pool_id,
                group_name=group,
                description=f"EV Hacks {group}",
            )

        # Hosted UI domain (must be globally unique within region)
        self.user_pool_domain = self.user_pool.add_domain(
            "HostedUiDomain",
            cognito_domain=cognito.CognitoDomainOptions(
                domain_prefix="evhacks-onewithai"
            ),
        )

        # Browser client — no secret, PKCE, supports SRP + admin auth for testing
        self.pwa_client = self.user_pool.add_client(
            "PwaClient",
            user_pool_client_name="evh-pwa",
            generate_secret=False,
            auth_flows=cognito.AuthFlow(
                user_srp=True,
                admin_user_password=True,
            ),
            o_auth=cognito.OAuthSettings(
                flows=cognito.OAuthFlows(authorization_code_grant=True),
                scopes=[cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
                callback_urls=[
                    "http://localhost:5173/auth/callback",
                    "https://main.evhacks.amplifyapp.com/auth/callback",
                ],
                logout_urls=[
                    "http://localhost:5173/",
                    "https://main.evhacks.amplifyapp.com/",
                ],
            ),
            access_token_validity=Duration.hours(8),
            id_token_validity=Duration.hours(8),
            refresh_token_validity=Duration.days(30),
        )

        # Server-side client — has secret, used by Django for admin operations
        self.api_client = self.user_pool.add_client(
            "ApiClient",
            user_pool_client_name="evh-api",
            generate_secret=True,
            auth_flows=cognito.AuthFlow(
                admin_user_password=True,
                user_password=True,
            ),
        )

        token_issuer = (
            f"https://cognito-idp.{self.region}.amazonaws.com/{self.user_pool.user_pool_id}"
        )

        CfnOutput(self, "UserPoolId", value=self.user_pool.user_pool_id, export_name="EvhUserPoolId")
        CfnOutput(self, "UserPoolArn", value=self.user_pool.user_pool_arn, export_name="EvhUserPoolArn")
        CfnOutput(self, "PwaClientId", value=self.pwa_client.user_pool_client_id, export_name="EvhPwaClientId")
        CfnOutput(self, "ApiClientId", value=self.api_client.user_pool_client_id, export_name="EvhApiClientId")
        CfnOutput(self, "HostedUiDomain", value=self.user_pool_domain.domain_name, export_name="EvhHostedUiDomain")
        CfnOutput(
            self,
            "HostedUiUrl",
            value=f"https://{self.user_pool_domain.domain_name}.auth.{self.region}.amazoncognito.com",
            export_name="EvhHostedUiUrl",
        )
        CfnOutput(self, "TokenIssuer", value=token_issuer, export_name="EvhTokenIssuer")
