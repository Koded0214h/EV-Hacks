#!/usr/bin/env python3
import os
import aws_cdk as cdk

from infra.stacks.network_stack import EvhNetworkStack
from infra.stacks.data_stack import EvhDataStack
from infra.stacks.auth_stack import EvhAuthStack
from infra.stacks.ingest_stack import EvhIngestStack
from infra.stacks.compute_stack import EvhComputeStack
from infra.stacks.cicd_stack import EvhCicdStack
from infra.stacks.cdn_stack import EvhCdnStack
from infra.stacks.ml_stack import EvhMlStack


app = cdk.App()

env = cdk.Environment(
    account=os.getenv("CDK_DEFAULT_ACCOUNT"),
    region=os.getenv("CDK_DEFAULT_REGION", "eu-west-1"),
)

network = EvhNetworkStack(app, "EvhNetworkStack", env=env)
data = EvhDataStack(app, "EvhDataStack", network=network, env=env)
auth = EvhAuthStack(app, "EvhAuthStack", env=env)
ingest = EvhIngestStack(app, "EvhIngestStack", data=data, env=env)
compute = EvhComputeStack(
    app, "EvhComputeStack",
    network=network, data=data, auth=auth, ingest=ingest, env=env,
)
EvhCicdStack(app, "EvhCicdStack", compute=compute, env=env)
EvhCdnStack(app, "EvhCdnStack", env=env)
# EvhMlStack disabled — demand scoring runs in Django (zones/scoring.py).
# Re-enable when a sklearn 1.2.1 + numpy<2 model.tar.gz is ready.
# EvhMlStack(app, "EvhMlStack", data_bucket_name=data.data_bucket.bucket_name, env=env)

cdk.Tags.of(app).add("Project", "EVHacks")
cdk.Tags.of(app).add("Team", "EVHacks")
cdk.Tags.of(app).add("Owner", "240404075@live.unilag.edu.ng")
cdk.Tags.of(app).add("Hackathon", "OneWithAI-2026")

app.synth()
