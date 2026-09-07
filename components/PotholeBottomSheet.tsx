import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Pothole } from '../models/Pothole';
import { SeverityBadge } from './SeverityBadge';
import { formatDistance } from '../utils/haversine';
import { formatDate } from '../utils/formatters';
import { openTurnByTurnNavigation } from '../services/navigationService';
import { sharePothole } from '../services/sharingService';
import { usePotholeStore } from '../stores/potholeStore';
import { useRouter } from 'expo-router';
import { Navigation, Share2, ThumbsUp, ThumbsDown, Wrench, X } from 'lucide-react-native';

interface PotholeBottomSheetProps {
  pothole: Pothole | null;
  userLat?: number;
  userLon?: number;
  onClose: () => void;
}

export const PotholeBottomSheet: React.FC<PotholeBottomSheetProps> = ({
  pothole,
  userLat,
  userLon,
  onClose,
}) => {
  const router = useRouter();
  const { confirmPothole, rejectPothole, markRepaired } = usePotholeStore();

  if (!pothole) return null;

  const distanceText =
    pothole.distanceMeters !== undefined
      ? formatDistance(pothole.distanceMeters)
      : userLat && userLon
      ? formatDistance(
          require('../utils/haversine').calculateDistance(
            userLat,
            userLon,
            pothole.latitude,
            pothole.longitude
          )
        )
      : 'Nearby';

  return (
    <View style={styles.sheetContainer}>
      <View style={styles.grabber} />

      <View style={styles.headerRow}>
        <View style={styles.titleInfo}>
          <Text style={styles.potholeId}>Pothole #{pothole.id.slice(-4).toUpperCase()}</Text>
          <Text style={styles.roadName} numberOfLines={1}>
            {pothole.roadName || 'Road Hazard'}
          </Text>
        </View>

        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <X size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <View style={styles.badgeRow}>
        <SeverityBadge severity={pothole.severity} />
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceText}>
            {Math.round(pothole.confidence * 100)}% Conf
          </Text>
        </View>
        <Text style={styles.metaText}>{formatDate(pothole.detectionTimestamp)}</Text>
        <Text style={styles.distanceText}>• {distanceText}</Text>
      </View>

      {/* Evidence Thumbnail if available */}
      {pothole.imageUrl && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: pothole.imageUrl }} style={styles.evidenceImage} />
          <View style={styles.votesBadge}>
            <Text style={styles.votesText}>👍 {pothole.voteCount} citizens confirmed</Text>
          </View>
        </View>
      )}

      {/* Community Action Row */}
      <View style={styles.communityRow}>
        <TouchableOpacity
          style={styles.communityBtn}
          onPress={() => confirmPothole(pothole.id)}
        >
          <ThumbsUp size={14} color="#10B981" />
          <Text style={styles.communityBtnText}>Confirm</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.communityBtn}
          onPress={() => rejectPothole(pothole.id)}
        >
          <ThumbsDown size={14} color="#EF4444" />
          <Text style={styles.communityBtnText}>Not Pothole</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.communityBtn}
          onPress={() => markRepaired(pothole.id)}
        >
          <Wrench size={14} color="#38BDF8" />
          <Text style={styles.communityBtnText}>Repaired</Text>
        </TouchableOpacity>
      </View>

      {/* Primary Actions Row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.detailsBtn]}
          onPress={() => router.push(`/pothole/${pothole.id}`)}
        >
          <Text style={styles.detailsBtnText}>View Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.navBtn]}
          onPress={() =>
            openTurnByTurnNavigation(pothole.latitude, pothole.longitude, pothole.roadName)
          }
        >
          <Navigation size={16} color="#0F172A" />
          <Text style={styles.navBtnText}>Directions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconActionBtn}
          onPress={() => sharePothole(pothole)}
        >
          <Share2 size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    padding: 18,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 20,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleInfo: {
    flex: 1,
    marginRight: 10,
  },
  potholeId: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  roadName: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#1E293B',
    borderRadius: 9999,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  confidenceBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  confidenceText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  metaText: {
    color: '#64748B',
    fontSize: 11,
  },
  distanceText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  imageContainer: {
    height: 110,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 12,
  },
  evidenceImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  votesBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  votesText: {
    color: '#F1F5F9',
    fontSize: 11,
    fontWeight: '600',
  },
  communityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  communityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  communityBtnText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  detailsBtnText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 13,
  },
  navBtn: {
    flex: 1.2,
    flexDirection: 'row',
    backgroundColor: '#38BDF8',
    gap: 6,
  },
  navBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13,
  },
  iconActionBtn: {
    padding: 12,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
