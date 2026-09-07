import unittest
from main import haversine_distance, POTHOLES_DB, app
from fastapi.testclient import TestClient

client = TestClient(app)

class TestPotholeBackend(unittest.TestCase):
    def test_haversine_distance_zero(self):
        d = haversine_distance(26.4499, 80.3319, 26.4499, 80.3319)
        self.assertAlmostEqual(d, 0.0, places=1)

    def test_haversine_distance_known(self):
        # Coordinates ~500m apart
        d = haversine_distance(26.4499, 80.3319, 26.4544, 80.3319)
        self.assertTrue(450 < d < 550, f"Expected approx 500m, got {d}")

    def test_get_root(self):
        res = client.get("/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["service"], "PotholeGuard Backend & Telemetry API")

    def test_get_potholes(self):
        res = client.get("/api/potholes")
        self.assertEqual(res.status_code, 200)
        self.assertGreater(len(res.json()), 0)

    def test_duplicate_prevention(self):
        # Submit pothole at exactly existing coordinate
        existing = POTHOLES_DB[0]
        payload = {
            "latitude": existing["latitude"],
            "longitude": existing["longitude"],
            "confidence": 0.95,
            "severity": "high",
            "roadName": "Duplicate Test Road"
        }
        res = client.post("/api/potholes", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["isDuplicate"])

    def test_live_simulation(self):
        res = client.get("/api/telemetry/live-simulation?step=5")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("latitude", data)
        self.assertIn("speed", data)

if __name__ == "__main__":
    unittest.main()
