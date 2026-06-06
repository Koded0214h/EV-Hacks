from django.test import SimpleTestCase


BRIEF_PAYLOAD = {
    "zone_id": "lagos_lekki_1",
    "roi_result": {
        "station_type": "dc_fast",
        "num_ports": 4,
        "capex_ngn": 12000000,
        "opex_monthly_ngn": 450000,
        "scenarios": {
            "base": {
                "daily_sessions_per_port": 10.82,
                "avg_revenue_per_session_ngn": 2000,
                "monthly_gross_ngn": 2596800,
                "monthly_net_ngn": 2146800,
                "payback_months": 5.59,
                "roi_12m_pct": 114.68,
            }
        },
    },
}


class BriefEndpointTests(SimpleTestCase):
    def test_generate_returns_200(self):
        res = self.client.post("/api/v1/brief/generate/", BRIEF_PAYLOAD, content_type="application/json")
        self.assertEqual(res.status_code, 200)

    def test_generate_shape(self):
        res = self.client.post("/api/v1/brief/generate/", BRIEF_PAYLOAD, content_type="application/json")
        data = res.json()
        for field in ["brief_id", "zone_id", "headline", "summary", "key_metrics", "risk_factors", "recommendation"]:
            self.assertIn(field, data, msg=f"Missing field: {field}")

    def test_generate_key_metrics_is_list(self):
        res = self.client.post("/api/v1/brief/generate/", BRIEF_PAYLOAD, content_type="application/json")
        self.assertIsInstance(res.json()["key_metrics"], list)

    def test_generate_risk_factors_is_list(self):
        res = self.client.post("/api/v1/brief/generate/", BRIEF_PAYLOAD, content_type="application/json")
        self.assertIsInstance(res.json()["risk_factors"], list)
