import React from 'react';
import { View, StyleSheet, Platform, Text, TouchableOpacity } from 'react-native';
import { Pothole } from '../models/Pothole';
import { getSeverityColor } from '../services/severityService';

interface MapViewComponentProps {
  userLat: number;
  userLon: number;
  potholes: Pothole[];
  selectedPothole: Pothole | null;
  onSelectPothole: (pothole: Pothole) => void;
  onRecenter?: () => void;
}

export const MapViewComponent: React.FC<MapViewComponentProps> = ({
  userLat,
  userLon,
  potholes,
  selectedPothole,
  onSelectPothole,
  onRecenter,
}) => {
  // Generate markers JSON for Leaflet web iframe
  const markersData = potholes.map((p) => ({
    id: p.id,
    lat: p.latitude,
    lon: p.longitude,
    color: getSeverityColor(p.severity),
    severity: p.severity,
    road: p.roadName || 'Road Hazard',
    conf: Math.round(p.confidence * 100),
  }));

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #0b0f19; }
          .custom-pin {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 2px solid #ffffff;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            cursor: pointer;
            transition: transform 0.2s ease;
          }
          .custom-pin:hover { transform: scale(1.2); }
          .user-pulse {
            width: 20px;
            height: 20px;
            background: #38bdf8;
            border-radius: 50%;
            border: 3px solid #ffffff;
            box-shadow: 0 0 15px #38bdf8;
          }
          /* Dark Map Filter */
          .leaflet-tile {
            filter: brightness(0.65) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const userPos = [${userLat}, ${userLon}];
          const map = L.map('map', { zoomControl: false }).setView(userPos, 15);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          // Pulsing user location marker
          const userIcon = L.divIcon({
            className: 'user-pulse-container',
            html: '<div class="user-pulse"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          L.marker(userPos, { icon: userIcon }).addTo(map);

          // Pothole markers
          const markers = ${JSON.stringify(markersData)};
          markers.forEach(m => {
            const icon = L.divIcon({
              className: 'pin-container',
              html: '<div class="custom-pin" style="background-color: ' + m.color + '"><span style="font-size:12px;font-weight:900;color:#fff;">⚠</span></div>',
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            });
            const marker = L.marker([m.lat, m.lon], { icon: icon }).addTo(map);
            marker.on('click', () => {
              if (window.parent) {
                window.parent.postMessage(JSON.stringify({ type: 'SELECT_POTHOLE', id: m.id }), '*');
              }
            });
          });

          window.addEventListener('message', (e) => {
            try {
              const data = JSON.parse(e.data);
              if (data.type === 'PAN_TO') {
                map.setView([data.lat, data.lon], 16, { animate: true });
              }
            } catch(err) {}
          });
        </script>
      </body>
    </html>
  `;

  // Listen to postMessage on web
  React.useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handler = (event: MessageEvent) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data && data.type === 'SELECT_POTHOLE') {
            const match = potholes.find((p) => p.id === data.id);
            if (match) onSelectPothole(match);
          }
        } catch {}
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }
  }, [potholes]);

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        React.createElement('iframe', {
          srcDoc: htmlContent,
          style: { width: '100%', height: '100%', border: 'none' },
          title: 'Pothole Interactive Map',
        })
      ) : (
        // Mobile fallback view with simulated high-contrast radar map
        <View style={styles.mobileMapCanvas}>
          <Text style={styles.mobileText}>Interactive High-Accuracy Map</Text>
          <Text style={styles.mobileSubtext}>
            Lat: {userLat.toFixed(4)}, Lon: {userLon.toFixed(4)}
          </Text>
          <View style={styles.radarRing1} />
          <View style={styles.radarRing2} />
          <View style={styles.userDot} />
        </View>
      )}

      {/* Recenter Button */}
      {onRecenter && (
        <TouchableOpacity style={styles.recenterBtn} onPress={onRecenter}>
          <Text style={styles.recenterText}>📍 Center</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    position: 'relative',
  },
  recenterBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  recenterText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  mobileMapCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  mobileText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  mobileSubtext: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  radarRing1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  radarRing2: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.1)',
  },
  userDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#38BDF8',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
