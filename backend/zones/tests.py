from django.test import SimpleTestCase
from django.urls import reverse


class ZoneEndpointTests(SimpleTestCase):
    def test_zone_list_returns_200(self):
        res = self.client.get("/api/v1/zones/")
        self.assertEqual(res.status_code, 200)

    def test_zone_list_shape(self):
        res = self.client.get("/api/v1/zones/")
        data = res.json()
        self.assertIn("count", data)
        self.assertIn("zones", data)
        self.assertIsInstance(data["zones"], list)
        self.assertGreater(data["count"], 0)

    def test_zone_list_item_has_required_fields(self):
        res = self.client.get("/api/v1/zones/")
        zone = res.json()["zones"][0]
        for field in ["zone_id", "name", "centroid", "demand_score", "tier", "pop_density", "poi_count", "ev_traffic", "station_count"]:
            self.assertIn(field, zone, msg=f"Missing field: {field}")

    def test_zone_detail_returns_200(self):
        res = self.client.get("/api/v1/zones/lagos_lekki_1/")
        self.assertEqual(res.status_code, 200)

    def test_zone_detail_correct_zone(self):
        res = self.client.get("/api/v1/zones/lagos_lekki_1/")
        self.assertEqual(res.json()["zone_id"], "lagos_lekki_1")

    def test_zone_detail_not_found(self):
        res = self.client.get("/api/v1/zones/does_not_exist/")
        self.assertEqual(res.status_code, 404)

    def test_zone_detail_404_error_envelope(self):
        res = self.client.get("/api/v1/zones/does_not_exist/")
        data = res.json()
        self.assertTrue(data["error"])
        self.assertIn("message", data)
        self.assertIn("code", data)

    def test_zone_bbox_returns_200(self):
        res = self.client.get("/api/v1/zones/bbox/?sw_lat=6.4&sw_lng=3.3&ne_lat=6.6&ne_lng=3.5")
        self.assertEqual(res.status_code, 200)

    def test_zone_bbox_has_zones(self):
        res = self.client.get("/api/v1/zones/bbox/")
        self.assertIn("zones", res.json())


class StationEndpointTests(SimpleTestCase):
    def test_station_list_returns_200(self):
        res = self.client.get("/api/v1/stations/")
        self.assertEqual(res.status_code, 200)

    def test_station_list_shape(self):
        res = self.client.get("/api/v1/stations/")
        data = res.json()
        self.assertIn("count", data)
        self.assertIn("stations", data)
        self.assertIsInstance(data["stations"], list)

    def test_station_item_has_required_fields(self):
        res = self.client.get("/api/v1/stations/")
        station = res.json()["stations"][0]
        for field in ["station_id", "name", "lat", "lng", "type", "ports", "status"]:
            self.assertIn(field, station, msg=f"Missing field: {field}")

    def test_station_report_returns_200(self):
        res = self.client.post(
            "/api/v1/stations/report/",
            {"station_id": "sta-001", "status": "busy", "reporter_type": "driver"},
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)

    def test_station_report_success_shape(self):
        res = self.client.post(
            "/api/v1/stations/report/",
            {"station_id": "sta-001", "status": "busy", "reporter_type": "driver"},
            content_type="application/json",
        )
        data = res.json()
        self.assertTrue(data["success"])
        self.assertIn("station_id", data)
        self.assertIn("new_status", data)

    def test_station_report_missing_fields_returns_400(self):
        res = self.client.post("/api/v1/stations/report/", {}, content_type="application/json")
        self.assertEqual(res.status_code, 400)
