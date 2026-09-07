import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DetectionResult } from '../models/Detection';
import { Pothole } from '../models/Pothole';
import { AlertTriangle, CheckCircle2 } from 'lucide-react-native';

interface DetectionOverlayProps {
  detection: DetectionResult | null;
  lastConfirmedPothole: Pothole | null;
  showAlert: boolean;
  containerWidth: number;
  containerHeight: number;
}

export const DetectionOverlay: React.FC<DetectionOverlayProps> = ({
  detection,
  lastConfirmedPothole,
  showAlert,
  containerWidth,
  containerHeight,
}) => {
  // Compute pixel positions from normalized bounding box
  const hasBox = detection && detection.detected && detection.boundingBox;

  const boxStyle = hasBox
    ? {
        left: detection.boundingBox.x * containerWidth,
        top: detection.boundingBox.y * containerHeight,
        width: detection.boundingBox.width * containerWidth,
        height: detection.boundingBox.height * containerHeight,
      }
    : null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Dynamic AI Bounding Box */}
      {hasBox && boxStyle && (
        <View style={[styles.boundingBox, boxStyle]}>
          <View style={styles.boxTag}>
            <Text style={styles.boxTagText}>
              POTHOLE {Math.round(detection.confidence * 100)}%
            </Text>
          </View>
        </View>
      )}

      {/* Prominent Driving Warning Overlay */}
      {showAlert && (
        <View style={styles.alertBanner}>
          <View style={styles.alertIconRow}>
            <AlertTriangle size={24} color="#EF4444" />
            <Text style={styles.alertTitle}>POTHOLE AHEAD</Text>
          </View>

          {lastConfirmedPothole && (
            <>
              <View style={styles.alertDetailsRow}>
                <Text style={styles.alertConfidence}>
                  Confidence: {Math.round(lastConfirmedPothole.confidence * 100)}%
                </Text>
                <View style={styles.capturedBadge}>
                  <CheckCircle2 size={12} color="#10B981" />
                  <Text style={styles.capturedText}>Coordinates Dispatched</Text>
                </View>
              </View>

              <View style={styles.coordinatesDispatchedRow}>
                <Text style={styles.coordinatesDispatchedText}>
                  📍 Lat: {lastConfirmedPothole.latitude.toFixed(6)}°  Lon: {lastConfirmedPothole.longitude.toFixed(6)}°
                </Text>
                <Text style={styles.speedText}>
                  🚗 {Math.round(lastConfirmedPothole.speedAtDetection || 30)} km/h
                </Text>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  boundingBox: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: '#EF4444',
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  boxTag: {
    position: 'absolute',
    top: -24,
    left: -2,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  boxTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  alertBanner: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  alertIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertTitle: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  alertDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  alertConfidence: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  capturedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  capturedText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  coordinatesDispatchedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#131A29',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  coordinatesDispatchedText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  speedText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
});
