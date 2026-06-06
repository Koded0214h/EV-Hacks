import json
import uuid

from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response

from zones.stubs import STUB_BRIEF, STUB_ZONES

USE_STUBS = False
_GEMINI_MODEL = "gemini-2.5-flash"
def _gemini_brief(prompt: str) -> dict:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    response = client.models.generate_content(
        model=_GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )
    return json.loads(response.text)


def _build_prompt(zone_stub, roi_result):
    zone_name = zone_stub["name"] if zone_stub else roi_result.get("location", {}).get("name") or "Unknown Zone"
    demand_score = float(zone_stub["demand_score"] if zone_stub else roi_result.get("demand_score", 70))
    pop_density = int(zone_stub.get("pop_density", 4000) if zone_stub else 4000)
    poi_count = int(zone_stub.get("poi_count", 200) if zone_stub else 200)
    ev_daily = round(float(zone_stub.get("ev_traffic", 0.5) if zone_stub else 0.5) * 3500)
    station_count = int(zone_stub["station_count"] if zone_stub else roi_result.get("competitor_count", 0))

    scenarios = roi_result.get("scenarios", {})
    base = scenarios.get("base", {})
    conservative = scenarios.get("conservative", {})
    optimistic = scenarios.get("optimistic", {})

    capex = int(roi_result.get("capex_ngn", 8_000_000))
    opex = int(roi_result.get("opex_monthly_ngn", 450_000))
    station_type = roi_result.get("station_type", "dc_fast").replace("_", " ").title()
    num_ports = roi_result.get("num_ports", 4)

    def n(v, fmt="ngn"):
        try:
            val = float(v)
            if fmt == "ngn":
                return f"₦{int(val):,}"
            if fmt == "pct":
                return f"{val:.0f}%"
            if fmt == "mo":
                return f"{val:.1f} months"
        except (TypeError, ValueError):
            pass
        return "N/A"

    prompt = f"""You are a senior investment analyst specialising in EV charging infrastructure in Nigeria.

Produce a concise, data-driven investor brief for this opportunity. Use Nigerian market context and Naira (₦) throughout. Be specific — cite the actual numbers from the data, not generic statements.

ZONE: {zone_name} — Lagos, Nigeria
- Demand Score: {demand_score}/100
- Population Density: {pop_density:,}/km²
- Points of Interest nearby: {poi_count}
- Estimated EV Traffic: ~{ev_daily:,} vehicles/day
- Existing Charging Stations within 5 km: {station_count}

PROPOSED STATION: {station_type}, {num_ports} ports
- Capital Expenditure: {n(capex)}
- Monthly OPEX: {n(opex)}

FINANCIAL PROJECTIONS:
| Scenario     | Monthly Net Revenue      | Payback                   | 12-Month ROI              |
|--------------|--------------------------|---------------------------|---------------------------|
| Conservative | {n(conservative.get('monthly_net_ngn'))} | {n(conservative.get('payback_months'), 'mo')} | {n(conservative.get('roi_12m_pct'), 'pct')} |
| Base Case    | {n(base.get('monthly_net_ngn'))}         | {n(base.get('payback_months'), 'mo')}         | {n(base.get('roi_12m_pct'), 'pct')}         |
| Optimistic   | {n(optimistic.get('monthly_net_ngn'))}   | {n(optimistic.get('payback_months'), 'mo')}   | {n(optimistic.get('roi_12m_pct'), 'pct')}   |

Return ONLY a JSON object with these exact keys (no markdown, no code fences):
{{
  "headline": "One punchy sentence (max 120 chars) with a key number that captures the investment case",
  "summary": "Three paragraphs separated by \\n\\n: (1) demand picture and market context for {zone_name}, (2) financial case with specific ₦ figures from the projections, (3) risks and timing considerations",
  "key_metrics": [
    {{"label": "Demand Score", "value": "{demand_score:.0f}/100"}},
    {{"label": "Payback Period", "value": "{n(base.get('payback_months'), 'mo')}"}},
    {{"label": "12-Month ROI", "value": "{n(base.get('roi_12m_pct'), 'pct')}"}},
    {{"label": "Monthly Net (Base)", "value": "{n(base.get('monthly_net_ngn'))}"}},
    {{"label": "Competitor Stations", "value": "{station_count} within 5 km"}}
  ],
  "risk_factors": ["2 to 4 specific risks for {zone_name} and {station_type} stations — not generic"],
  "recommendation": "Go / Proceed with caution / No-go — one sentence with specific reasoning from the data"
}}"""

    return prompt


@extend_schema(
    summary="Generate AI investor brief",
    description="Calls Gemini 2.5 Flash to produce a structured investor brief from zone and ROI data.",
    request=inline_serializer("BriefRequest", fields={
        "zone_id": serializers.CharField(),
        "roi_result": serializers.DictField(),
    }),
    responses={
        200: inline_serializer("AIBriefResult", fields={
            "brief_id": serializers.UUIDField(),
            "zone_id": serializers.CharField(),
            "generated_at": serializers.DateTimeField(),
            "headline": serializers.CharField(),
            "summary": serializers.CharField(),
            "key_metrics": serializers.ListField(),
            "risk_factors": serializers.ListField(child=serializers.CharField()),
            "recommendation": serializers.CharField(),
        }),
        400: OpenApiTypes.OBJECT,
        502: OpenApiTypes.OBJECT,
    },
)
@api_view(["POST"])
def brief_generate(request):
    zone_id = request.data.get("zone_id")
    roi_result = request.data.get("roi_result")

    if not zone_id or not roi_result:
        return Response(
            {"error": True, "message": "zone_id and roi_result are required", "code": "ERR_VALIDATION"},
            status=400,
        )

    if USE_STUBS:
        return Response(STUB_BRIEF)

    api_key = getattr(settings, "GEMINI_API_KEY", "")
    if not api_key:
        # Key not configured yet — return stub so the UI doesn't break
        return Response(STUB_BRIEF)

    zone_stub = next((z for z in STUB_ZONES if z["zone_id"] == zone_id), None)
    prompt = _build_prompt(zone_stub, roi_result)

    try:
        result = _gemini_brief(prompt)
        return Response({
            "brief_id": str(uuid.uuid4()),
            "zone_id": zone_id,
            "generated_at": timezone.now().isoformat(),
            **result,
        })
    except Exception as e:
        return Response(
            {"error": True, "message": str(e), "code": "ERR_GEMINI"},
            status=502,
        )
