from django.test import SimpleTestCase


PING_PAYLOAD = {
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "lat": 6.4281,
    "lng": 3.4219,
    "speed_kmh": 34.2,
    "recorded_at": "2025-06-06T08:00:00Z",
}


class MobilityEndpointTests(SimpleTestCase):
    def test_ping_returns_200(self):
        res = self.client.post("/api/v1/mobility/ping/", PING_PAYLOAD, content_type="application/json")
        self.assertEqual(res.status_code, 200)

    def test_ping_success_shape(self):
        res = self.client.post("/api/v1/mobility/ping/", PING_PAYLOAD, content_type="application/json")
        data = res.json()
        self.assertTrue(data["success"])
        self.assertIn("zone_id", data)

    def test_heatmap_returns_200(self):
        res = self.client.get("/api/v1/mobility/heatmap/")
        self.assertEqual(res.status_code, 200)

    def test_heatmap_is_geojson(self):
        res = self.client.get("/api/v1/mobility/heatmap/")
        data = res.json()
        self.assertEqual(data["type"], "FeatureCollection")
        self.assertIn("features", data)

    def test_heatmap_feature_has_weight(self):
        res = self.client.get("/api/v1/mobility/heatmap/")
        feature = res.json()["features"][0]
        self.assertIn("weight", feature["properties"])
