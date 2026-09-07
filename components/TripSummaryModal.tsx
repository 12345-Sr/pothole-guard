import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  Linking,
} from 'react-native';
import { TripSession } from '../models/Session';
import {
  X,
  Flag,
  MapPin,
  Clock,
  Gauge,
  Share2,
  Navigation,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react-native';
import * as Sharing from 'expo-sharing';

const BACKEND_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.1.40:8000';

interface TripSummaryModalProps {
  trip: TripSession | null;
  visible: boolean;
  onClose: () => void;
}

export const TripSummaryModal: React.FC<TripSummaryModalProps> = ({
  trip,
  visible,
  onClose,
}) => {
  if (!trip) return null;

  const mins = Math.floor(trip.durationSeconds / 60);
  const secs = trip.durationSeconds % 60;
  const durationText = `${mins}m ${secs.toString().padStart(2, '0')}s`;

  const qualityColor =
    trip.roadQuality === 'EXCELLENT' || trip.roadQuality === 'GOOD'
      ? '#10B981'
      : trip.roadQuality === 'FAIR'
      ? '#F59E0B'
      : '#EF4444';

  const shareTripUrl = `${BACKEND_BASE}/trip/${trip.id}`;

  const handleShareTrip = async () => {
    const msg =
      `🏁 PotholeGuard Trip Route Report!\n\n` +
      `🟢 Start Point A: ${trip.startPoint.roadName || 'Origin'} (${trip.startPoint.latitude.toFixed(5)}, ${trip.startPoint.longitude.toFixed(5)})\n` +
      `🔴 Stop Point B: ${trip.endPoint.roadName || 'Stop'} (${trip.endPoint.latitude.toFixed(5)}, ${trip.endPoint.longitude.toFixed(5)})\n\n` +
      `⚠️ Potholes Encountered: ${trip.potholesCount}\n` +
      `📏 Distance Traveled: ${trip.distanceKm.toFixed(2)} km\n` +
      `⏱️ Duration: ${durationText}\n` +
      `🛣️ Road Condition: ${trip.roadQuality}\n\n` +
      `🔍 View Full Forensic Route Report & Photos:\n${shareTripUrl}`;

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({
            title: `PotholeGuard Trip: ${trip.potholesCount} Potholes Found`,
            text: msg,
            url: shareTripUrl,
          });
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(msg);
          alert('Trip Report link copied to clipboard!\n\n' + shareTripUrl);
        }
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Linking.openURL(`sms:&body=${encodeURIComponent(msg)}`);
        } else {
          await Linking.openURL(shareTripUrl);
        }
      }
    } catch (e) {
      console.warn('Share trip failed', e);
    }
  };

  const handleOpenGoogleMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${trip.startPoint.latitude},${trip.startPoint.longitude}&destination=${trip.endPoint.latitude},${trip.endPoint.longitude}`;
    Linking.openURL(url);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <Flag size={18} color="#38BDF8" />
              <Text style={styles.headerTitle}>RIDE TRIP REPORT</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* Big Pothole Counter Card */}
            <View style={styles.potholeCountCard}>
              <Text style={styles.potholeCountNumber}>{trip.potholesCount}</Text>
              <Text style={styles.potholeCountLabel}>
                POTHOLES ENCOUNTERED (POINT A ➔ POINT B)
              </Text>
              <View style={[styles.qualityPill, { borderColor: qualityColor }]}>
                <Text style={[styles.qualityPillText, { color: qualityColor }]}>
                  ROAD CONDITION: {trip.roadQuality}
                </Text>
              </View>
            </View>

            {/* Route Points Card */}
            <View style={styles.routeCard}>
              <View style={styles.routePointRow}>
                <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                <View style={styles.routePointInfo}>
                  <Text style={styles.pointLabel}>🟢 POINT A (CAMERA STARTED)</Text>
                  <Text style={styles.pointRoad} numberOfLines={1}>
                    {trip.startPoint.roadName || 'Origin Location'}
                  </Text>
                  <Text style={styles.pointCoords}>
                    {trip.startPoint.latitude.toFixed(6)}°, {trip.startPoint.longitude.toFixed(6)}°
                  </Text>
                </View>
              </View>

              <View style={styles.routeDivider} />

              <View style={styles.routePointRow}>
                <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                <View style={styles.routePointInfo}>
                  <Text style={styles.pointLabel}>🔴 POINT B (CAMERA STOPPED)</Text>
                  <Text style={styles.pointRoad} numberOfLines={1}>
                    {trip.endPoint.roadName || 'Stop Location'}
                  </Text>
                  <Text style={styles.pointCoords}>
                    {trip.endPoint.latitude.toFixed(6)}°, {trip.endPoint.longitude.toFixed(6)}°
                  </Text>
                </View>
              </View>
            </View>

            {/* Telemetry Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <MapPin size={16} color="#38BDF8" />
                <Text style={styles.statLabel}>DISTANCE</Text>
                <Text style={styles.statVal}>{trip.distanceKm.toFixed(2)} km</Text>
              </View>

              <View style={styles.statBox}>
                <Clock size={16} color="#A78BFA" />
                <Text style={styles.statLabel}>DURATION</Text>
                <Text style={styles.statVal}>{durationText}</Text>
              </View>

              <View style={styles.statBox}>
                <Gauge size={16} color="#F59E0B" />
                <Text style={styles.statLabel}>AVG SPEED</Text>
                <Text style={styles.statVal}>{trip.averageSpeedKmh.toFixed(1)} km/h</Text>
              </View>

              <View style={styles.statBox}>
                <AlertTriangle size={16} color="#EF4444" />
                <Text style={styles.statLabel}>CRITICAL</Text>
                <Text style={styles.statVal}>{trip.severityBreakdown.critical}</Text>
              </View>
            </View>

            {/* List of Potholes on this Route */}
            <Text style={styles.sectionHeader}>
              POTHOLES LOGGED ON THIS ROUTE ({trip.potholes.length})
            </Text>

            {trip.potholes.length === 0 ? (
              <View style={styles.emptyCard}>
                <CheckCircle2 size={24} color="#10B981" />
                <Text style={styles.emptyText}>
                  Zero potholes detected between Point A and Point B. Excellent smooth road!
                </Text>
              </View>
            ) : (
              trip.potholes.map((p, idx) => (
                <View key={p.id || idx} style={styles.potholeItemCard}>
                  {p.imageUrl ? (
                    <Image source={{ uri: p.imageUrl }} style={styles.potholeThumb} />
                  ) : (
                    <View style={styles.potholeThumbPlaceholder}>
                      <Text style={{ color: '#64748B', fontSize: 10 }}>NO PHOTO</Text>
                    </View>
                  )}
                  <View style={styles.potholeItemDetails}>
                    <View style={styles.potholeItemHeader}>
                      <Text style={styles.potholeItemIdx}>#{idx + 1} HAZARD</Text>
                      <View
                        style={[
                          styles.sevBadge,
                          {
                            backgroundColor:
                              p.severity === 'critical' || p.severity === 'high'
                                ? 'rgba(239, 68, 68, 0.2)'
                                : 'rgba(245, 158, 11, 0.2)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.sevBadgeText,
                            {
                              color:
                                p.severity === 'critical' || p.severity === 'high'
                                  ? '#EF4444'
                                  : '#F59E0B',
                            },
                          ]}
                        >
                          {p.severity.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.potholeItemCoords}>
                      📍 {p.latitude.toFixed(6)}°, {p.longitude.toFixed(6)}°
                    </Text>
                    <Text style={styles.potholeItemRoad} numberOfLines={1}>
                      {p.roadName || 'Current Street'}
                    </Text>
                  </View>
                </View>
              ))
            )}

            {/* Primary Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.shareBtn]}
                onPress={handleShareTrip}
                activeOpacity={0.8}
              >
                <Share2 size={16} color="#090D16" />
                <Text style={styles.shareBtnText}>SHARE TRIP REPORT</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.mapBtn]}
                onPress={handleOpenGoogleMaps}
                activeOpacity={0.8}
              >
                <Navigation size={16} color="#38BDF8" />
                <Text style={styles.mapBtnText}>VIEW ROUTE</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.doneBtnText}>CLOSE & START NEW RIDE</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 13, 22, 0.88)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#1E293B',
    borderRadius: 20,
  },
  scrollArea: {
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  potholeCountCard: {
    backgroundColor: '#131A29',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  potholeCountNumber: {
    fontSize: 54,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: -1,
  },
  potholeCountLabel: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 4,
    textAlign: 'center',
  },
  qualityPill: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  qualityPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  routeCard: {
    backgroundColor: '#131A29',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  routePointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  routePointInfo: {
    flex: 1,
  },
  pointLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pointRoad: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  pointCoords: {
    color: '#38BDF8',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  routeDivider: {
    height: 20,
    width: 2,
    backgroundColor: '#334155',
    marginLeft: 5,
    marginVertical: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#131A29',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
  },
  statVal: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHeader: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: '#131A29',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  potholeItemCard: {
    flexDirection: 'row',
    backgroundColor: '#131A29',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  potholeThumb: {
    width: 70,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#000',
  },
  potholeThumbPlaceholder: {
    width: 70,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#090D16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  potholeItemDetails: {
    flex: 1,
  },
  potholeItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  potholeItemIdx: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
  },
  sevBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sevBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  potholeItemCoords: {
    color: '#F8FAFC',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  potholeItemRoad: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  shareBtn: {
    backgroundColor: '#38BDF8',
  },
  shareBtnText: {
    color: '#090D16',
    fontSize: 12,
    fontWeight: '900',
  },
  mapBtn: {
    backgroundColor: '#131A29',
    borderColor: '#334155',
    borderWidth: 1,
  },
  mapBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '900',
  },
  doneBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    marginTop: 6,
  },
  doneBtnText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
});
