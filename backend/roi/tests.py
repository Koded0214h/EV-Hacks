from django.test import TestCase as SimpleTestCase


ROI_PAYLOAD = {
    "lat": 6.4281,
    "lng": 3.4219,
    "station_type": "dc_fast",
    "num_ports": 4,
    "capex_ngn": 12000000,
    "opex_monthly_ngn": 450000,
    "target_segment": "mixed",
}


class ROIEndpointTests(SimpleTestCase):
    def test_calculate_returns_200(self):
        res = self.client.post("/api/v1/roi/calculate/", ROI_PAYLOAD, content_type="application/json")
        self.assertEqual(res.status_code, 200)

    def test_calculate_has_three_scenarios(self):
        res = self.client.post("/api/v1/roi/calculate/", ROI_PAYLOAD, content_type="application/json")
        scenarios = res.json()["scenarios"]
        self.assertIn("conservative", scenarios)
        self.assertIn("base", scenarios)
        self.assertIn("optimistic", scenarios)

    def test_calculate_scenario_shape(self):
        res = self.client.post("/api/v1/roi/calculate/", ROI_PAYLOAD, content_type="application/json")
        base = res.json()["scenarios"]["base"]
        for field in ["daily_sessions_per_port", "avg_revenue_per_session_ngn", "monthly_gross_ngn", "monthly_net_ngn", "payback_months", "roi_12m_pct"]:
            self.assertIn(field, base, msg=f"Missing field: {field}")

    def test_calculate_missing_fields_returns_400(self):
        res = self.client.post("/api/v1/roi/calculate/", {}, content_type="application/json")
        self.assertEqual(res.status_code, 400)

    def test_compare_returns_200(self):
        res = self.client.get("/api/v1/roi/compare/?zone_ids=lagos_lekki_1,lagos_yaba_1&station_type=dc_fast&num_ports=4&capex_ngn=12000000&opex_monthly_ngn=450000&target_segment=mixed")
        self.assertEqual(res.status_code, 200)

    def test_compare_returns_list(self):
        res = self.client.get("/api/v1/roi/compare/?zone_ids=lagos_lekki_1,lagos_yaba_1")
        self.assertIn("comparisons", res.json())
        self.assertIsInstance(res.json()["comparisons"], list)
