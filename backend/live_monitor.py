"""
Live Real-Time Pothole Coordinates Monitor.
Polls or listens to live incoming detections from the mobile scanner and prints
real-time latitude and longitude coordinates.
"""

import time
import requests
import sys

BACKEND_URL = "http://localhost:8000"

def main():
    print("=" * 65)
    print("🛰️  POTHOLEGUARD REAL-TIME COORDINATES MONITOR ACTIVE")
    print(f"🔗 Connected to Civic API at: {BACKEND_URL}")
    print("=" * 65)

    seen_ids = set()

    # Initial check
    try:
        res = requests.get(f"{BACKEND_URL}/api/potholes", timeout=3)
        if res.status_code == 200:
            for p in res.json():
                seen_ids.add(p["id"])
            print(f"✅ Initialized with {len(seen_ids)} existing database hazard markers.\n")
            print("Listening for incoming REAL-TIME camera detections from app...\n")
    except Exception as e:
        print(f"❌ Could not connect to {BACKEND_URL}: {e}")
        return

    while True:
        try:
            res = requests.get(f"{BACKEND_URL}/api/potholes", timeout=3)
            if res.status_code == 200:
                potholes = res.json()
                for p in potholes:
                    if p["id"] not in seen_ids:
                        seen_ids.add(p["id"])
                        print("━" * 65)
                        print(f"🚨 [REAL-TIME POTHOLE DETECTED & DISPATCHED]")
                        print(f"   📍 Latitude:   {p['latitude']:.6f}°")
                        print(f"   📍 Longitude:  {p['longitude']:.6f}°")
                        print(f"   🎯 Confidence: {int(p.get('confidence', 0) * 100)}%")
                        print(f"   ⚠️ Severity:   {p.get('severity', 'medium').upper()}")
                        print(f"   🚗 Speed:      {p.get('speedAtDetection', 0):.1f} km/h")
                        print(f"   🛣️ Road:       {p.get('roadName', 'Corridor')}")
                        print(f"   🕒 Timestamp:  {p.get('detectionTimestamp')}")
                        print(f"   🗺️ Map View:   https://maps.google.com/?q={p['latitude']},{p['longitude']}")
                        print("━" * 65 + "\n")
            time.sleep(1)
        except KeyboardInterrupt:
            print("\nStopped monitor.")
            break
        except Exception:
            time.sleep(1)

if __name__ == "__main__":
    main()
