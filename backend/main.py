"""
PotholeGuard Live Telemetry & Civic Backend
Persistent SQLite Database + Image Storage + Realtime Telemetry
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional
import datetime
import uuid
import math
import random
import os
import sqlite3
import base64
import json

# Base paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "potholes.db")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Initialize SQLite Database
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS potholes (
            id TEXT PRIMARY KEY,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            confidence REAL NOT NULL,
            severity TEXT NOT NULL,
            status TEXT NOT NULL,
            roadName TEXT,
            city TEXT,
            state TEXT,
            country TEXT,
            imageUrl TEXT,
            detectionTimestamp TEXT NOT NULL,
            reportedBy TEXT,
            voteCount INTEGER DEFAULT 1,
            speedAtDetection REAL,
            heading REAL,
            gpsAccuracy REAL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS trips (
            id TEXT PRIMARY KEY,
            startedAt TEXT NOT NULL,
            endedAt TEXT NOT NULL,
            startLat REAL NOT NULL,
            startLon REAL NOT NULL,
            startRoad TEXT,
            startCity TEXT,
            endLat REAL NOT NULL,
            endLon REAL NOT NULL,
            endRoad TEXT,
            endCity TEXT,
            distanceKm REAL NOT NULL,
            durationSeconds INTEGER NOT NULL,
            potholesCount INTEGER NOT NULL,
            averageSpeedKmh REAL,
            roadQuality TEXT NOT NULL,
            potholesJson TEXT,
            createdAt TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

app = FastAPI(
    title="PotholeGuard Live Civic API",
    version="2.0.0",
    description="Real-time pothole detection, persistent SQLite DB, screenshot storage & GPS telemetry",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded screenshots statically
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# Serve Expo Web production build statically if built
DIST_DIR = os.path.join(os.path.dirname(BASE_DIR), "dist")
if os.path.exists(DIST_DIR):
    expo_static = os.path.join(DIST_DIR, "_expo")
    if os.path.exists(expo_static):
        app.mount("/_expo", StaticFiles(directory=expo_static), name="expo_static")
    assets_static = os.path.join(DIST_DIR, "assets")
    if os.path.exists(assets_static):
        app.mount("/assets", StaticFiles(directory=assets_static), name="expo_assets")

# Active real-time WebSocket listeners
active_connections: List[WebSocket] = []

@app.websocket("/ws/potholes")
async def websocket_potholes(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.remove(websocket)

async def broadcast_detection(event_data: dict):
    for conn in list(active_connections):
        try:
            await conn.send_json(event_data)
        except Exception:
            if conn in active_connections:
                active_connections.remove(conn)

class PotholeReportCreate(BaseModel):
    latitude: float
    longitude: float
    confidence: Optional[float] = 0.88
    severity: Optional[str] = "medium"
    description: Optional[str] = None
    imageUrl: Optional[str] = None
    roadName: Optional[str] = "Current Road"
    city: Optional[str] = "Local Area"
    state: Optional[str] = ""
    country: Optional[str] = "India"
    speed: Optional[float] = None
    heading: Optional[float] = None
    accuracy: Optional[float] = 5.0

class TripPointModel(BaseModel):
    latitude: float
    longitude: float
    timestamp: str
    roadName: Optional[str] = "Point"
    city: Optional[str] = "Local Area"

class TripCreate(BaseModel):
    id: Optional[str] = None
    startedAt: str
    endedAt: str
    startPoint: TripPointModel
    endPoint: TripPointModel
    distanceKm: float
    durationSeconds: int
    potholesCount: int
    averageSpeedKmh: Optional[float] = 0.0
    roadQuality: Optional[str] = "FAIR"
    potholes: Optional[List[dict]] = []

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def save_screenshot_image(pot_id: str, image_data: Optional[str], base_url: str) -> Optional[str]:
    """Saves a base64 screenshot to disk in backend/uploads and returns full accessible URL."""
    if not image_data or not image_data.startswith("data:image"):
        return image_data

    try:
        # Extract base64 payload
        header, encoded = image_data.split(",", 1)
        ext = "jpg"
        if "png" in header:
            ext = "png"
        
        filename = f"screenshot_{pot_id}.{ext}"
        filepath = os.path.join(UPLOADS_DIR, filename)
        
        with open(filepath, "wb") as f:
            f.write(base64.b64decode(encoded))
            
        return f"{base_url}/uploads/{filename}"
    except Exception as e:
        print("Error saving screenshot to file:", e)
        return image_data

@app.get("/")
def read_root():
    index_path = os.path.join(DIST_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM potholes")
    count = cursor.fetchone()[0]
    conn.close()
    return {
        "service": "PotholeGuard Live Civic API & Database",
        "status": "online",
        "database": "SQLite (Persistent)",
        "active_potholes_count": count,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

@app.get("/scan")
@app.get("/map")
@app.get("/profile")
@app.get("/stats")
def serve_spa():
    index_path = os.path.join(DIST_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "PotholeGuard SPA frontend"}

@app.get("/favicon.ico")
def serve_favicon():
    fav_path = os.path.join(DIST_DIR, "favicon.ico")
    if os.path.exists(fav_path):
        return FileResponse(fav_path)
    raise HTTPException(status_code=404)

@app.get("/api/potholes")
def get_potholes(
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius_meters: Optional[float] = 10000.0,
    status: Optional[str] = None
):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if status and status != "all":
        cursor.execute("SELECT * FROM potholes WHERE status = ? ORDER BY createdAt DESC", (status,))
    else:
        cursor.execute("SELECT * FROM potholes ORDER BY createdAt DESC")
        
    rows = cursor.fetchall()
    results = [dict(row) for row in rows]
    conn.close()

    if lat is not None and lon is not None:
        filtered = []
        for p in results:
            dist = haversine_distance(lat, lon, p["latitude"], p["longitude"])
            if dist <= radius_meters:
                item = dict(p)
                item["distance_meters"] = round(dist, 1)
                filtered.append(item)
        filtered.sort(key=lambda x: x.get("distance_meters", 0))
        return filtered

    return results

@app.get("/api/potholes/{pothole_id}")
def get_pothole_by_id(pothole_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM potholes WHERE id = ?", (pothole_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    raise HTTPException(status_code=404, detail="Pothole not found")

@app.post("/api/potholes")
async def create_pothole(report: PotholeReportCreate, request: Request):
    """
    Real-time detection handler:
    Accepts real-time latitude, longitude, and camera screenshot,
    saves the screenshot to disk, writes to SQLite, checks duplicates, and broadcasts.
    """
    base_url = str(request.base_url).rstrip("/")
    # Replace localhost with actual IP for client reachability if request came via IP
    client_host = request.headers.get("host", "localhost:8000")
    if client_host:
        base_url = f"http://{client_host}"

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    pot_id = f"pot-{uuid.uuid4().hex[:8]}"

    # Save screenshot image permanently to uploads directory
    saved_image_url = save_screenshot_image(pot_id, report.imageUrl, base_url)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Check duplicates within 10 meters
    cursor.execute("SELECT * FROM potholes")
    existing_rows = cursor.fetchall()
    for row in existing_rows:
        dist = haversine_distance(report.latitude, report.longitude, row["latitude"], row["longitude"])
        if dist <= 10.0:
            new_vote_count = row["voteCount"] + 1
            cursor.execute("UPDATE potholes SET voteCount = ?, updatedAt = ? WHERE id = ?", (new_vote_count, now_iso, row["id"]))
            conn.commit()
            
            cursor.execute("SELECT * FROM potholes WHERE id = ?", (row["id"],))
            updated_pothole = dict(cursor.fetchone())
            conn.close()
            
            print(f"\n🔁 [POTHOLE MERGED (DUPLICATE WITHIN 10m)] => LAT: {row['latitude']:.6f}, LON: {row['longitude']:.6f}, VOTES: {new_vote_count}")
            payload = {
                "event": "pothole_confirmed_duplicate",
                "message": "Pothole confirmed at existing spot",
                "pothole": updated_pothole,
                "isDuplicate": True
            }
            await broadcast_detection(payload)
            return payload

    # Insert fresh pothole into SQLite
    cursor.execute("""
        INSERT INTO potholes (
            id, latitude, longitude, confidence, severity, status,
            roadName, city, state, country, imageUrl, detectionTimestamp,
            reportedBy, voteCount, speedAtDetection, heading, gpsAccuracy,
            createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        pot_id,
        report.latitude,
        report.longitude,
        report.confidence or 0.85,
        report.severity or "medium",
        "detected",
        report.roadName or "Current Location",
        report.city or "Local Area",
        report.state or "",
        report.country or "India",
        saved_image_url,
        now_iso,
        "Live Mobile Scanner",
        1,
        report.speed or 0.0,
        report.heading or 0.0,
        report.accuracy or 5.0,
        now_iso,
        now_iso
    ))
    conn.commit()

    cursor.execute("SELECT * FROM potholes WHERE id = ?", (pot_id,))
    new_pothole = dict(cursor.fetchone())
    conn.close()

    print(f"\n🚨 [REAL-TIME POTHOLE SAVED TO DATABASE] => LAT: {report.latitude:.6f}, LON: {report.longitude:.6f}, SPEED: {report.speed or 0:.1f} km/h, SCREENSHOT: {saved_image_url}")

    payload = {
        "event": "new_pothole_detected",
        "message": "Real-time pothole registered in database",
        "pothole": new_pothole,
        "isDuplicate": False
    }
    await broadcast_detection(payload)
    return payload

@app.delete("/api/potholes/clear-all")
def clear_all_potholes():
    """Removes all stored potholes for a clean live slate."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM potholes")
    conn.commit()
    conn.close()
    return {"message": "All potholes deleted. Database reset to clean state."}

@app.get("/health")
def health_check():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM potholes")
    count = cursor.fetchone()[0]
    conn.close()
    return {
        "status": "healthy",
        "service": "PotholeGuard Live Backend",
        "database": "SQLite",
        "total_potholes_logged": count,
        "uploads_dir": UPLOADS_DIR,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

@app.post("/api/potholes/{pothole_id}/confirm")
def confirm_pothole(pothole_id: str):
    """Citizen verification: increments vote count and updates confirmation status."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM potholes WHERE id = ?", (pothole_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Hazard not found")
    
    new_votes = row["voteCount"] + 1
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    cursor.execute("UPDATE potholes SET voteCount = ?, status = 'confirmed', updatedAt = ? WHERE id = ?", (new_votes, now_iso, pothole_id))
    conn.commit()
    
    cursor.execute("SELECT * FROM potholes WHERE id = ?", (pothole_id,))
    updated = dict(cursor.fetchone())
    conn.close()
    return {
        "success": True,
        "message": f"Hazard confirmed by citizen. Total votes: {new_votes}",
        "pothole": updated
    }

# Public Shareable Web Report Page
@app.get("/pothole/{pothole_id}", response_class=HTMLResponse)
def get_pothole_share_page(pothole_id: str, request: Request):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM potholes WHERE id = ?", (pothole_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return HTMLResponse(
            content="""
            <!DOCTYPE html>
            <html>
            <head>
                <title>Hazard Not Found — PotholeGuard</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { background: #090d16; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .card { text-align: center; padding: 40px; background: #131a29; border: 1px solid #1e293b; border-radius: 16px; max-width: 400px; }
                    a { color: #38bdf8; text-decoration: none; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1 style="font-size: 48px; margin: 0;">⚠️</h1>
                    <h2>Hazard Not Found</h2>
                    <p style="color: #94a3b8;">This road hazard record may have been cleared or the link is expired.</p>
                    <a href="/dashboard">View Live Civic Dashboard →</a>
                </div>
            </body>
            </html>
            """,
            status_code=404
        )

    p = dict(row)
    sev = p["severity"].lower()
    sev_color = "#ef4444" if sev in ("critical", "high") else ("#f59e0b" if sev == "medium" else "#10b981")
    sev_bg = "rgba(239, 68, 68, 0.15)" if sev in ("critical", "high") else ("rgba(245, 158, 11, 0.15)" if sev == "medium" else "rgba(16, 185, 129, 0.15)")
    share_url = str(request.url)
    maps_nav_url = f"https://www.google.com/maps/dir/?api=1&destination={p['latitude']},{p['longitude']}"
    maps_embed_url = f"https://maps.google.com/maps?q={p['latitude']},{p['longitude']}&hl=en&z=17&output=embed"

    img_html = f"""
        <div style="position: relative; overflow: hidden; border-radius: 14px; border: 1px solid #1e293b; background: #0b1120; margin-bottom: 24px;">
            <img src="{p['imageUrl']}" alt="Road Evidence" style="width: 100%; max-height: 420px; object-fit: cover; display: block;" />
            <div style="position: absolute; bottom: 12px; left: 12px; background: rgba(9, 13, 22, 0.85); backdrop-filter: blur(8px); padding: 6px 12px; border-radius: 8px; border: 1px solid #334155; font-size: 11px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
                📸 REAL-TIME CAMERA EVIDENCE
            </div>
        </div>
    """ if p["imageUrl"] else """
        <div style="padding: 40px; text-align: center; background: #131a29; border: 1px dashed #334155; border-radius: 14px; color: #64748b; margin-bottom: 24px;">
            📷 No camera snapshot attached to this report
        </div>
    """

    whatsapp_text = f"🚨 Road Hazard Alert: {p['severity'].upper()} pothole reported at {p['roadName']} ({p['latitude']:.6f}, {p['longitude']:.6f})! See photo & details: {share_url}"
    whatsapp_url = f"https://api.whatsapp.com/send?text={whatsapp_text}"

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>PotholeGuard Forensic Report — {p['roadName']}</title>
        <meta name="description" content="Live road hazard report: {p['severity'].upper()} severity pothole at {p['latitude']:.5f}, {p['longitude']:.5f}">
        <!-- OpenGraph for rich WhatsApp/iMessage previews -->
        <meta property="og:title" content="🚨 Road Hazard Alert: {p['severity'].upper()} Pothole">
        <meta property="og:description" content="Location: {p['roadName']}. Speed: {p['speedAtDetection']:.1f} km/h. Verified by {p['voteCount']} citizens.">
        <meta property="og:image" content="{p['imageUrl'] or ''}">
        <meta property="og:type" content="website">
        <style>
            * {{ box-sizing: border-box; }}
            body {{
                background: #090d16;
                color: #f8fafc;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                margin: 0;
                padding: 16px;
                display: flex;
                justify-content: center;
            }}
            .wrapper {{
                width: 100%;
                max-width: 680px;
                margin: 0 auto;
                padding-bottom: 40px;
            }}
            .top-bar {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 12px;
                border-bottom: 1px solid #1e293b;
            }}
            .brand {{
                font-weight: 900;
                font-size: 17px;
                color: #ffffff;
                display: flex;
                align-items: center;
                gap: 8px;
            }}
            .brand-sub {{
                color: #94a3b8;
                font-size: 11px;
                font-weight: 500;
            }}
            .card {{
                background: #131a29;
                border: 1px solid #1e293b;
                border-radius: 18px;
                padding: 24px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            }}
            .badge-row {{
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                align-items: center;
                margin-bottom: 16px;
            }}
            .sev-pill {{
                background: {sev_bg};
                color: {sev_color};
                border: 1px solid {sev_color};
                padding: 6px 14px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 800;
                letter-spacing: 0.5px;
                text-transform: uppercase;
            }}
            .status-pill {{
                background: #1e293b;
                color: #38bdf8;
                border: 1px solid #334155;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 700;
            }}
            .road-title {{
                font-size: 22px;
                font-weight: 800;
                margin: 0 0 6px 0;
                color: #ffffff;
            }}
            .area-subtitle {{
                color: #94a3b8;
                font-size: 14px;
                margin: 0 0 20px 0;
            }}
            .telemetry-grid {{
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
                margin-bottom: 24px;
            }}
            @media (max-width: 480px) {{
                .telemetry-grid {{ grid-template-columns: 1fr; }}
            }}
            .telemetry-item {{
                background: #0d1320;
                border: 1px solid #1e293b;
                border-radius: 12px;
                padding: 12px 14px;
            }}
            .telemetry-label {{
                font-size: 11px;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 700;
                margin-bottom: 4px;
            }}
            .telemetry-val {{
                font-size: 15px;
                font-weight: 700;
                color: #f8fafc;
            }}
            .map-container {{
                border-radius: 14px;
                overflow: hidden;
                border: 1px solid #1e293b;
                margin-bottom: 24px;
                height: 240px;
                background: #0f172a;
            }}
            iframe {{
                width: 100%;
                height: 100%;
                border: 0;
            }}
            .actions-grid {{
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                margin-bottom: 16px;
            }}
            @media (max-width: 480px) {{
                .actions-grid {{ grid-template-columns: 1fr; }}
            }}
            .btn {{
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 14px;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 700;
                text-decoration: none;
                cursor: pointer;
                border: none;
                transition: transform 0.1s, opacity 0.2s;
            }}
            .btn:active {{ transform: scale(0.98); }}
            .btn-nav {{
                background: #38bdf8;
                color: #090d16;
            }}
            .btn-confirm {{
                background: #10b981;
                color: #090d16;
            }}
            .btn-whatsapp {{
                background: #25d366;
                color: #ffffff;
            }}
            .btn-copy {{
                background: #1e293b;
                color: #f8fafc;
                border: 1px solid #334155;
            }}
            .footer {{
                text-align: center;
                margin-top: 24px;
                color: #64748b;
                font-size: 12px;
            }}
            .footer a {{ color: #38bdf8; text-decoration: none; }}
            #toast {{
                visibility: hidden;
                min-width: 250px;
                background-color: #38bdf8;
                color: #090d16;
                text-align: center;
                border-radius: 8px;
                padding: 12px;
                position: fixed;
                z-index: 100;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                font-weight: 700;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            }}
            #toast.show {{
                visibility: visible;
                animation: fadein 0.3s, fadeout 0.3s 2.5s;
            }}
            @keyframes fadein {{ from {{ bottom: 0; opacity: 0; }} to {{ bottom: 30px; opacity: 1; }} }}
            @keyframes fadeout {{ from {{ bottom: 30px; opacity: 1; }} to {{ bottom: 0; opacity: 0; }} }}
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="top-bar">
                <div>
                    <div class="brand">🛡️ PotholeGuard</div>
                    <div class="brand-sub">Civic Road Safety & Telemetry Network</div>
                </div>
                <a href="/dashboard" style="background: #1e293b; color: #38bdf8; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; text-decoration: none; border: 1px solid #334155;">
                    Live Dashboard 📊
                </a>
            </div>

            <div class="card">
                <div class="badge-row">
                    <span class="sev-pill">{p['severity']} HAZARD</span>
                    <span class="status-pill">{p['status'].upper()}</span>
                    <span style="color: #94a3b8; font-size: 12px; margin-left: auto;">
                        Report #{p['id']}
                    </span>
                </div>

                <h1 class="road-title">{p['roadName']}</h1>
                <p class="area-subtitle">{p['city'] or 'Local Area'}{', ' + p['state'] if p['state'] else ''} • India</p>

                {img_html}

                <div class="telemetry-grid">
                    <div class="telemetry-item">
                        <div class="telemetry-label">📍 GPS Coordinates</div>
                        <div class="telemetry-val" style="color: #38bdf8; font-family: monospace;">
                            {p['latitude']:.6f}°, {p['longitude']:.6f}°
                        </div>
                    </div>

                    <div class="telemetry-item">
                        <div class="telemetry-label">🎯 AI Confidence</div>
                        <div class="telemetry-val">
                            {int(p['confidence'] * 100)}% Match
                        </div>
                    </div>

                    <div class="telemetry-item">
                        <div class="telemetry-label">🏍️ Vehicle Speed</div>
                        <div class="telemetry-val">
                            {p['speedAtDetection']:.1f} km/h
                        </div>
                    </div>

                    <div class="telemetry-item">
                        <div class="telemetry-label">👥 Citizen Verifications</div>
                        <div class="telemetry-val" id="voteCountDisplay">
                            {p['voteCount']} Confirmations
                        </div>
                    </div>

                    <div class="telemetry-item" style="grid-column: span 2;">
                        <div class="telemetry-label">🕒 Detection Timestamp</div>
                        <div class="telemetry-val" style="font-size: 13px; color: #94a3b8;">
                            {p['detectionTimestamp']}
                        </div>
                    </div>
                </div>

                <div class="map-container">
                    <iframe src="{maps_embed_url}" loading="lazy"></iframe>
                </div>

                <div class="actions-grid">
                    <a href="{maps_nav_url}" target="_blank" class="btn btn-nav">
                        🧭 Turn-by-Turn Navigation
                    </a>

                    <button onclick="confirmPothole()" class="btn btn-confirm" id="confirmBtn">
                        👍 Confirm Hazard (+1)
                    </button>
                </div>

                <div class="actions-grid">
                    <a href="{whatsapp_url}" target="_blank" class="btn btn-whatsapp">
                        💬 Share on WhatsApp
                    </a>

                    <button onclick="copyLink()" class="btn btn-copy">
                        📋 Copy Share Link
                    </button>
                </div>
            </div>

            <div class="footer">
                Captured with PotholeGuard Real-Time Mobile Vision & GPS Scanner.<br/>
                <a href="/dashboard">View all recorded road hazards across the network</a>
            </div>
        </div>

        <div id="toast">Link copied to clipboard!</div>

        <script>
            function showToast(text) {{
                const t = document.getElementById('toast');
                t.innerText = text;
                t.className = 'show';
                setTimeout(() => {{ t.className = t.className.replace('show', ''); }}, 2800);
            }}

            function copyLink() {{
                if (navigator.clipboard) {{
                    navigator.clipboard.writeText(window.location.href).then(() => {{
                        showToast('📋 Live share link copied!');
                    }});
                }} else {{
                    showToast('Link: ' + window.location.href);
                }}
            }}

            async function confirmPothole() {{
                const btn = document.getElementById('confirmBtn');
                btn.disabled = true;
                btn.innerText = 'Verifying...';
                try {{
                    const res = await fetch('/api/potholes/{p["id"]}/confirm', {{ method: 'POST' }});
                    const data = await res.json();
                    if (data.success) {{
                        document.getElementById('voteCountDisplay').innerText = data.pothole.voteCount + ' Confirmations';
                        btn.innerText = '✅ Confirmed!';
                        btn.style.background = '#059669';
                        showToast('✅ Verification recorded in civic database!');
                    }} else {{
                        btn.innerText = '👍 Confirm Hazard';
                        btn.disabled = false;
                    }}
                }} catch (e) {{
                    btn.innerText = '👍 Confirm Hazard';
                    btn.disabled = false;
                    showToast('Network error, please try again.');
                }}
            }}
        </script>
    </body>
    </html>
    """

@app.post("/api/trips")
async def create_trip(trip: TripCreate, request: Request):
    """
    Saves a completed ride session from Point A to Point B with pothole counts and telemetry.
    """
    base_url = str(request.base_url).rstrip("/")
    client_host = request.headers.get("host", "localhost:8000")
    if client_host:
        base_url = f"http://{client_host}"

    trip_id = trip.id or f"trip-{uuid.uuid4().hex[:8]}"
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    potholes_json = json.dumps(trip.potholes or [])

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO trips (
            id, startedAt, endedAt, startLat, startLon, startRoad, startCity,
            endLat, endLon, endRoad, endCity, distanceKm, durationSeconds,
            potholesCount, averageSpeedKmh, roadQuality, potholesJson, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        trip_id,
        trip.startedAt,
        trip.endedAt,
        trip.startPoint.latitude,
        trip.startPoint.longitude,
        trip.startPoint.roadName or "Origin",
        trip.startPoint.city or "",
        trip.endPoint.latitude,
        trip.endPoint.longitude,
        trip.endPoint.roadName or "Destination",
        trip.endPoint.city or "",
        trip.distanceKm,
        trip.durationSeconds,
        trip.potholesCount,
        trip.averageSpeedKmh or 0.0,
        trip.roadQuality or "FAIR",
        potholes_json,
        now_iso
    ))
    conn.commit()
    conn.close()

    share_url = f"{base_url}/trip/{trip_id}"
    print(f"\n🏁 [TRIP SAVED] => Point A ({trip.startPoint.latitude:.4f}) ➔ Point B ({trip.endPoint.latitude:.4f}) | Potholes: {trip.potholesCount} | Dist: {trip.distanceKm} km | Link: {share_url}")

    return {
        "success": True,
        "tripId": trip_id,
        "shareUrl": share_url,
        "potholesCount": trip.potholesCount,
        "distanceKm": trip.distanceKm,
        "roadQuality": trip.roadQuality
    }

@app.get("/api/trips")
def get_trips():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM trips ORDER BY createdAt DESC")
    rows = cursor.fetchall()
    results = []
    for r in rows:
        item = dict(r)
        if item.get("potholesJson"):
            try:
                item["potholes"] = json.loads(item["potholesJson"])
            except Exception:
                item["potholes"] = []
        else:
            item["potholes"] = []
        results.append(item)
    conn.close()
    return results

@app.get("/trip/{trip_id}", response_class=HTMLResponse)
def get_trip_share_page(trip_id: str, request: Request):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM trips WHERE id = ?", (trip_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return HTMLResponse(
            content="""
            <!DOCTYPE html>
            <html>
            <head><title>Trip Not Found — PotholeGuard</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
            <body style="background:#090d16;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                <div style="text-align:center;padding:40px;background:#131a29;border:1px solid #1e293b;border-radius:16px;">
                    <h2>⚠️ Trip Record Not Found</h2>
                    <p style="color:#94a3b8;">This route report may have expired.</p>
                    <a href="/dashboard" style="color:#38bdf8;">Return to Civic Dashboard →</a>
                </div>
            </body>
            </html>
            """,
            status_code=404
        )

    t = dict(row)
    potholes = []
    if t.get("potholesJson"):
        try:
            potholes = json.loads(t["potholesJson"])
        except Exception:
            potholes = []

    share_url = str(request.url)
    maps_route_url = f"https://www.google.com/maps/dir/?api=1&origin={t['startLat']},{t['startLon']}&destination={t['endLat']},{t['endLon']}"
    maps_embed_url = f"https://maps.google.com/maps?saddr={t['startLat']},{t['startLon']}&daddr={t['endLat']},{t['endLon']}&hl=en&output=embed"

    mins = t['durationSeconds'] // 60
    secs = t['durationSeconds'] % 60
    dur_text = f"{mins}m {secs:02d}s"

    quality_color = "#10b981" if t['roadQuality'] in ("EXCELLENT", "GOOD") else ("#f59e0b" if t['roadQuality'] == "FAIR" else "#ef4444")

    potholes_cards_html = ""
    for idx, p in enumerate(potholes, 1):
        img_part = f'<img src="{p.get("imageUrl")}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 10px; margin-bottom: 8px;" />' if p.get("imageUrl") else ''
        potholes_cards_html += f"""
        <div style="background: #0d1320; border: 1px solid #1e293b; border-radius: 12px; padding: 12px; margin-bottom: 12px;">
            {img_part}
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#38bdf8; font-weight:bold; font-size:13px;">#{idx} Pothole Encountered</span>
                <span style="background:rgba(239,68,68,0.2); color:#ef4444; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:bold; text-transform:uppercase;">
                    {p.get('severity', 'hazard')}
                </span>
            </div>
            <div style="color:#94a3b8; font-size:12px; margin-top:4px; font-family:monospace;">
                📍 {p.get('latitude', 0):.6f}°, {p.get('longitude', 0):.6f}°
            </div>
            <div style="margin-top:6px;">
                <a href="/pothole/{p.get('id')}" target="_blank" style="color:#38bdf8; font-size:11px; text-decoration:none; font-weight:bold;">
                    View Forensic Evidence Snapshot →
                </a>
            </div>
        </div>
        """

    whatsapp_msg = f"🏍️ PotholeGuard Trip Report: Route from {t['startRoad']} to {t['endRoad']}. Found {t['potholesCount']} potholes over {t['distanceKm']:.1f} km ({t['roadQuality']} condition). View report: {share_url}"
    whatsapp_url = f"https://api.whatsapp.com/send?text={whatsapp_msg}"

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>PotholeGuard Trip Report — Point A to Point B ({t['potholesCount']} Potholes)</title>
        <meta name="description" content="Trip Report: {t['potholesCount']} potholes detected between {t['startRoad']} and {t['endRoad']} over {t['distanceKm']:.1f} km.">
        <meta property="og:title" content="🏍️ Road Trip Hazard Report: {t['potholesCount']} Potholes Found">
        <meta property="og:description" content="{t['distanceKm']:.1f} km route from {t['startRoad']} to {t['endRoad']}. Condition: {t['roadQuality']}.">
        <style>
            * {{ box-sizing: border-box; }}
            body {{ background: #090d16; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 16px; display: flex; justify-content: center; }}
            .wrapper {{ width: 100%; max-width: 680px; margin: 0 auto; padding-bottom: 40px; }}
            .card {{ background: #131a29; border: 1px solid #1e293b; border-radius: 18px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
            .highlight-box {{ background: #0d1320; border: 1px solid #1e293b; border-radius: 14px; padding: 16px; margin: 16px 0; text-align: center; }}
            .grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 16px 0; }}
            .item {{ background: #0b1120; border: 1px solid #1e293b; border-radius: 12px; padding: 12px; }}
            .label {{ font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }}
            .val {{ font-size: 15px; font-weight: bold; color: #f8fafc; }}
            .btn {{ display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border-radius: 12px; font-size: 14px; font-weight: bold; text-decoration: none; cursor: pointer; border: none; }}
            #toast {{ visibility: hidden; min-width: 250px; background: #38bdf8; color: #090d16; text-align: center; border-radius: 8px; padding: 12px; position: fixed; z-index: 100; bottom: 30px; left: 50%; transform: translateX(-50%); font-weight: bold; }}
            #toast.show {{ visibility: visible; animation: fadein 0.3s, fadeout 0.3s 2.5s; }}
            @keyframes fadein {{ from {{ bottom: 0; opacity: 0; }} to {{ bottom: 30px; opacity: 1; }} }}
            @keyframes fadeout {{ from {{ bottom: 30px; opacity: 1; }} to {{ bottom: 0; opacity: 0; }} }}
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #1e293b; padding-bottom: 12px;">
                <div>
                    <div style="font-weight: 900; font-size: 17px; color: #fff;">🛡️ PotholeGuard</div>
                    <div style="color: #94a3b8; font-size: 11px;">Trip Route Hazard Telemetry</div>
                </div>
                <a href="/dashboard" style="background:#1e293b; color:#38bdf8; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:bold; text-decoration:none; border:1px solid #334155;">
                    Live Dashboard 📊
                </a>
            </div>

            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid #38bdf8; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800;">
                        🏁 COMPLETED TRIP
                    </span>
                    <span style="color: {quality_color}; font-weight: 800; font-size: 12px; border: 1px solid {quality_color}; padding: 4px 10px; border-radius: 20px;">
                        ROAD: {t['roadQuality']}
                    </span>
                </div>

                <h1 style="font-size: 22px; font-weight: 800; margin: 16px 0 4px 0;">
                    {t['startRoad']} ➔ {t['endRoad']}
                </h1>
                <div style="color: #94a3b8; font-size: 13px; margin-bottom: 16px;">
                    From camera start to camera stop
                </div>

                <div class="highlight-box">
                    <div style="font-size: 42px; font-weight: 900; color: #ef4444;">
                        {t['potholesCount']}
                    </div>
                    <div style="font-size: 14px; font-weight: 800; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.5px;">
                        Potholes Detected Along This Route
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">
                        Density: {(t['potholesCount'] / max(0.1, t['distanceKm'])):.1f} potholes / km
                    </div>
                </div>

                <div class="grid">
                    <div class="item">
                        <div class="label">🟢 Point A (Origin)</div>
                        <div class="val" style="font-size: 12px; font-family: monospace; color: #10b981;">
                            {t['startLat']:.5f}°, {t['startLon']:.5f}°
                        </div>
                        <div style="color: #94a3b8; font-size: 11px; margin-top: 2px;">{t['startRoad']}</div>
                    </div>

                    <div class="item">
                        <div class="label">🔴 Point B (Stop)</div>
                        <div class="val" style="font-size: 12px; font-family: monospace; color: #ef4444;">
                            {t['endLat']:.5f}°, {t['endLon']:.5f}°
                        </div>
                        <div style="color: #94a3b8; font-size: 11px; margin-top: 2px;">{t['endRoad']}</div>
                    </div>

                    <div class="item">
                        <div class="label">📏 Route Distance</div>
                        <div class="val">{t['distanceKm']:.2f} km</div>
                    </div>

                    <div class="item">
                        <div class="label">⏱️ Trip Duration</div>
                        <div class="val">{dur_text}</div>
                    </div>
                </div>

                <div style="border-radius: 14px; overflow: hidden; border: 1px solid #1e293b; height: 220px; margin: 16px 0;">
                    <iframe src="{maps_embed_url}" style="width:100%; height:100%; border:0;" loading="lazy"></iframe>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 16px 0;">
                    <a href="{maps_route_url}" target="_blank" class="btn" style="background: #38bdf8; color: #090d16;">
                        🗺️ Google Maps
                    </a>
                    <a href="{whatsapp_url}" target="_blank" class="btn" style="background: #25d366; color: #fff;">
                        💬 WhatsApp
                    </a>
                </div>

                <button onclick="copyTripLink()" class="btn" style="width: 100%; background: #1e293b; color: #f8fafc; border: 1px solid #334155; margin-bottom: 20px;">
                    📋 Copy Shareable Trip Link
                </button>

                <h3 style="font-size: 16px; margin: 24px 0 12px 0; border-top: 1px solid #1e293b; padding-top: 16px;">
                    📸 Potholes Detected on this Ride ({len(potholes)})
                </h3>
                {potholes_cards_html if potholes else "<div style='color:#64748b; font-size:13px; text-align:center; padding:20px;'>No potholes detected on this ride. Clean stretch of road!</div>"}
            </div>
        </div>

        <div id="toast">Trip link copied to clipboard!</div>

        <script>
            function copyTripLink() {{
                if (navigator.clipboard) {{
                    navigator.clipboard.writeText(window.location.href).then(() => {{
                        const t = document.getElementById('toast');
                        t.className = 'show';
                        setTimeout(() => {{ t.className = t.className.replace('show', ''); }}, 2800);
                    }});
                }}
            }}
        </script>
    </body>
    </html>
    """

# Live Web Dashboard to view captured potholes, screenshots, and locations
@app.get("/dashboard", response_class=HTMLResponse)
def get_dashboard():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM potholes ORDER BY createdAt DESC")
    potholes = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT * FROM trips ORDER BY createdAt DESC")
    trips = [dict(row) for row in cursor.fetchall()]
    conn.close()

    rows_html = ""
    for p in potholes:
        img_tag = f'<img src="{p["imageUrl"]}" style="width: 140px; height: 90px; object-fit: cover; border-radius: 8px; border: 1px solid #334155;" />' if p["imageUrl"] else '<span style="color:#64748b;">No photo</span>'
        share_page_link = f"/pothole/{p['id']}"
        rows_html += f"""
        <tr style="border-bottom: 1px solid #1e293b;">
            <td style="padding: 12px;">{img_tag}</td>
            <td style="padding: 12px; font-weight: bold; color: #38bdf8;">
                {p['latitude']:.6f}° N<br/>
                {p['longitude']:.6f}° E
            </td>
            <td style="padding: 12px;">
                <span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">
                    {p['severity'].upper()}
                </span><br/>
                <small style="color: #94a3b8;">{int(p['confidence']*100)}% Conf</small>
            </td>
            <td style="padding: 12px; color: #f8fafc;">
                {p['roadName']}<br/>
                <small style="color: #64748b;">Speed: {p['speedAtDetection']:.1f} km/h</small>
            </td>
            <td style="padding: 12px; color: #94a3b8; font-size: 12px;">
                {p['detectionTimestamp'][:19]}<br/>
                <span style="color: #10b981; font-weight: 600;">{p['voteCount']} Votes</span>
            </td>
            <td style="padding: 12px; display: flex; flex-direction: column; gap: 6px;">
                <a href="{share_page_link}" target="_blank" style="background: #10b981; color: #090d16; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 11px; text-align: center;">
                    🔗 Live Result Link
                </a>
                <a href="https://maps.google.com/?q={p['latitude']},{p['longitude']}" target="_blank" style="background: #1e293b; color: #38bdf8; border: 1px solid #334155; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 11px; text-align: center;">
                    📍 Google Maps
                </a>
            </td>
        </tr>
        """

    trips_html = ""
    for t in trips:
        trip_share_link = f"/trip/{t['id']}"
        q_color = "#10b981" if t['roadQuality'] in ("EXCELLENT", "GOOD") else ("#f59e0b" if t['roadQuality'] == "FAIR" else "#ef4444")
        trips_html += f"""
        <tr style="border-bottom: 1px solid #1e293b;">
            <td style="padding: 12px; font-weight: bold; color: #f8fafc;">
                🟢 {t['startRoad']}<br/>
                <span style="color: #ef4444;">🔴 {t['endRoad']}</span>
            </td>
            <td style="padding: 12px; text-align: center;">
                <span style="font-size: 18px; font-weight: 900; color: #ef4444;">{t['potholesCount']}</span><br/>
                <small style="color: #94a3b8;">potholes</small>
            </td>
            <td style="padding: 12px; color: #38bdf8; font-weight: bold;">
                {t['distanceKm']:.2f} km<br/>
                <small style="color: #94a3b8;">{t['durationSeconds'] // 60}m {t['durationSeconds'] % 60}s</small>
            </td>
            <td style="padding: 12px;">
                <span style="color: {q_color}; font-weight: 800; font-size: 11px; border: 1px solid {q_color}; padding: 3px 8px; border-radius: 12px;">
                    {t['roadQuality']}
                </span>
            </td>
            <td style="padding: 12px;">
                <a href="{trip_share_link}" target="_blank" style="background: #38bdf8; color: #090d16; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 11px;">
                    🏁 View Trip Report
                </a>
            </td>
        </tr>
        """

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>PotholeGuard — Live Civic Database</title>
        <meta http-equiv="refresh" content="5">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {{ background: #090d16; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 24px; }}
            .container {{ max-width: 1100px; margin: 0 auto; }}
            .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px; }}
            .title {{ font-size: 24px; font-weight: 900; color: #ffffff; }}
            .badge {{ background: #10b981; color: #090d16; padding: 4px 10px; border-radius: 20px; font-weight: bold; font-size: 12px; }}
            table {{ width: 100%; border-collapse: collapse; background: #131a29; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b; margin-bottom: 32px; }}
            th {{ background: #0f172a; padding: 14px; text-align: left; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; }}
            .section-title {{ font-size: 18px; font-weight: 800; margin: 28px 0 12px 0; color: #38bdf8; display: flex; align-items: center; gap: 8px; }}
            .empty {{ text-align: center; padding: 48px; color: #64748b; font-size: 16px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div>
                    <div class="title">🛡️ PotholeGuard Live Database</div>
                    <div style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Real-time camera screenshots, coordinates, trips & road telemetry</div>
                </div>
                <div class="badge">● LIVE ({len(potholes)} Potholes, {len(trips)} Trips)</div>
            </div>

            <div class="section-title">🏍️ Completed Trip Routes (Point A ➔ Point B Pothole Counts)</div>
            {f"<table><thead><tr><th>Route (Start ➔ Stop)</th><th>Potholes Counted</th><th>Distance & Time</th><th>Road Condition</th><th>Action</th></tr></thead><tbody>{trips_html}</tbody></table>" if trips else "<div class='empty' style='background:#131a29; border-radius:12px; border:1px solid #1e293b; margin-bottom:32px;'>No trip routes recorded yet. Start camera scanning on a ride and tap Stop to see your Point A ➔ Point B trip report here!</div>"}

            <div class="section-title">📸 All Recorded Potholes with Forensic Evidence</div>
            {f"<table><thead><tr><th>Screenshot</th><th>Coordinates</th><th>Severity</th><th>Road & Speed</th><th>Activity</th><th>Action</th></tr></thead><tbody>{rows_html}</tbody></table>" if potholes else "<div class='empty'>No potholes captured yet. Point your phone camera at a road and start scanning to see live records appear here!</div>"}
        </div>
    </body>
    </html>
    """

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting server on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)


