from aws_cdk import (
    Stack,
    CfnOutput,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
)
from constructs import Construct


# Stable nip.io domain — DNS resolves to the EIP. Avoids the brittle
# AWS-assigned public DNS which can change if the instance is replaced.
EC2_ORIGIN_HOST = "34-251-241-87.nip.io"


class EvhCdnStack(Stack):
    """CloudFront in front of the EC2-hosted Django API.

    Terminates HTTPS using CloudFront's default *.cloudfront.net certificate
    so Vercel rewrites have an HTTPS target to proxy to.
    """

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        api_origin = origins.HttpOrigin(
            EC2_ORIGIN_HOST,
            http_port=8000,
            protocol_policy=cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        )

        self.distribution = cloudfront.Distribution(
            self,
            "BackendCdn",
            comment="EV Hacks — HTTPS in front of the Django EC2",
            default_behavior=cloudfront.BehaviorOptions(
                origin=api_origin,
                allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
                cached_methods=cloudfront.CachedMethods.CACHE_GET_HEAD,
                cache_policy=cloudfront.CachePolicy.CACHING_DISABLED,
                origin_request_policy=cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                compress=True,
            ),
            price_class=cloudfront.PriceClass.PRICE_CLASS_100,
        )

        CfnOutput(
            self,
            "CdnDomain",
            value=self.distribution.distribution_domain_name,
            export_name="EvhCdnDomain",
        )
        CfnOutput(
            self,
            "CdnUrl",
            value=f"https://{self.distribution.distribution_domain_name}",
            export_name="EvhCdnUrl",
        )
