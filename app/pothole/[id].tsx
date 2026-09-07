import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePotholeStore } from '../../stores/potholeStore';
import { SeverityBadge } from '../../components/SeverityBadge';
import { formatDate, formatConfidence } from '../../utils/formatters';
import { openTurnByTurnNavigation } from '../../services/navigationService';
import { sharePothole, copyPotholeLink, getShareableLink } from '../../services/sharingService';
import { Pothole } from '../../models/Pothole';
import {
  MapPin,
  Calendar,
  Shield,
  ThumbsUp,
  ThumbsDown,
  Navigation,
  Share2,
  CheckCircle2,
  Crosshair,
  Gauge,
  Link2,
} from 'lucide-react-native';

const BACKEND_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.1.40:8000';

export default function PotholeDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { potholes, confirmPothole, rejectPothole } = usePotholeStore();
  const [remotePothole, setRemotePothole] = useState<Pothole | null>(null);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const localPothole = potholes.find((p) => p.id === id);
  const pothole = localPothole || remotePothole;

  useEffect(() => {
    if (!localPothole && id) {
      setIsLoadingRemote(true);
      fetch(`${BACKEND_BASE}/api/potholes/${id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.id) {
            setRemotePothole(data);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingRemote(false));
    }
  }, [id, localPothole]);

  const handleCopyLink = async () => {
    if (!pothole) return;
    await copyPotholeLink(pothole);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  if (!pothole) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFoundContainer}>
          {isLoadingRemote ? (
            <ActivityIndicator size="large" color="#38BDF8" />
          ) : (
            <>
              <Text style={styles.notFoundText}>Hazard record not found</Text>
              <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                <Text style={styles.backBtnText}>Return to Map</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Large Evidence Image */}
        <View style={styles.imageCard}>
          <Image
            source={{
              uri:
                pothole.imageUrl ||
                'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=60',
            }}
            style={styles.evidenceImage}
          />
          <View style={styles.imageOverlay}>
            <SeverityBadge severity={pothole.severity} size="lg" />
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{pothole.status.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Hazard Header */}
        <View style={styles.headerBlock}>
          <Text style={styles.roadName}>{pothole.roadName || 'Roadway Hazard'}</Text>
          <Text style={styles.cityLocation}>
            {pothole.city || 'Kanpur'}, {pothole.state || 'Uttar Pradesh'}
          </Text>
        </View>

        {/* Primary Action Row */}
        <View style={styles.primaryActionRow}>
          <TouchableOpacity
            style={styles.navActionButton}
            onPress={() =>
              openTurnByTurnNavigation(
                pothole.latitude,
                pothole.longitude,
                pothole.roadName
              )
            }
          >
            <Navigation size={18} color="#090D16" />
            <Text style={styles.navActionText}>GET DIRECTIONS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareActionButton}
            onPress={() => sharePothole(pothole)}
          >
            <Share2 size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Public Shareable Link Banner */}
        <View style={styles.publicShareCard}>
          <View style={styles.publicShareLeft}>
            <Share2 size={18} color="#38BDF8" />
            <View style={{ flex: 1 }}>
              <Text style={styles.publicShareTitle}>PUBLIC LIVE REPORT LINK</Text>
              <Text style={styles.publicShareSubtitle} numberOfLines={1}>
                {getShareableLink(pothole.id)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.copyPillBtn}
            onPress={handleCopyLink}
            activeOpacity={0.8}
          >
            <Link2 size={13} color="#090D16" />
            <Text style={styles.copyPillText}>{copyFeedback ? 'COPIED!' : 'COPY'}</Text>
          </TouchableOpacity>
        </View>

        {/* Forensic Metadata Grid */}
        <Text style={styles.sectionHeader}>DETECTION FORENSICS</Text>
        <View style={styles.grid}>
          <View style={styles.gridCard}>
            <Shield size={16} color="#38BDF8" />
            <Text style={styles.gridLabel}>CONFIDENCE</Text>
            <Text style={styles.gridValue}>{formatConfidence(pothole.confidence)}</Text>
          </View>

          <View style={styles.gridCard}>
            <Crosshair size={16} color="#10B981" />
            <Text style={styles.gridLabel}>GPS ACCURACY</Text>
            <Text style={styles.gridValue}>
              ±{Math.round(pothole.gpsAccuracy || 4)}m
            </Text>
          </View>

          <View style={styles.gridCard}>
            <Gauge size={16} color="#F59E0B" />
            <Text style={styles.gridLabel}>VEHICLE SPEED</Text>
            <Text style={styles.gridValue}>
              {Math.round(pothole.speedAtDetection || 32)} km/h
            </Text>
          </View>

          <View style={styles.gridCard}>
            <Calendar size={16} color="#A78BFA" />
            <Text style={styles.gridLabel}>RECORDED</Text>
            <Text style={styles.gridValue}>{formatDate(pothole.detectionTimestamp)}</Text>
          </View>
        </View>

        {/* GPS Coordinates Box */}
        <View style={styles.coordsCard}>
          <MapPin size={20} color="#38BDF8" />
          <View style={styles.coordsInfo}>
            <Text style={styles.coordsLabel}>EXACT COORDINATES</Text>
            <Text style={styles.coordsValue}>
              {pothole.latitude.toFixed(6)}, {pothole.longitude.toFixed(6)}
            </Text>
          </View>
        </View>

        {/* Community Confirmations */}
        <Text style={styles.sectionHeader}>COMMUNITY VALIDATION</Text>
        <View style={styles.validationCard}>
          <View style={styles.votesCountRow}>
            <CheckCircle2 size={20} color="#10B981" />
            <Text style={styles.votesCountText}>
              {pothole.voteCount} citizens confirmed this pothole
            </Text>
          </View>

          <View style={styles.voteButtonsRow}>
            <TouchableOpacity
              style={[styles.voteButton, styles.confirmVote]}
              onPress={() => confirmPothole(pothole.id)}
            >
              <ThumbsUp size={16} color="#10B981" />
              <Text style={styles.confirmVoteText}>Confirm Pothole</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.voteButton, styles.rejectVote]}
              onPress={() => rejectPothole(pothole.id)}
            >
              <ThumbsDown size={16} color="#EF4444" />
              <Text style={styles.rejectVoteText}>Report Incorrect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  imageCard: {
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
  },
  evidenceImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusPillText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerBlock: {
    marginBottom: 16,
  },
  roadName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  cityLocation: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 4,
  },
  primaryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  navActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#38BDF8',
    paddingVertical: 14,
    borderRadius: 16,
  },
  navActionText: {
    color: '#090D16',
    fontSize: 14,
    fontWeight: '900',
  },
  shareActionButton: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#131A29',
    borderColor: '#1E293B',
    borderWidth: 1,
  },
  publicShareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#131A29',
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  publicShareLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  publicShareTitle: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  publicShareSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  copyPillBtn: {
    backgroundColor: '#38BDF8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyPillText: {
    color: '#090D16',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#131A29',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  gridLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  gridValue: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  coordsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#131A29',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  coordsInfo: {
    flex: 1,
  },
  coordsLabel: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },
  coordsValue: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  validationCard: {
    backgroundColor: '#131A29',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  votesCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  votesCountText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  voteButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  voteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  confirmVote: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
  },
  confirmVoteText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  rejectVote: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#EF4444',
  },
  rejectVoteText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  notFoundText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#38BDF8',
    borderRadius: 12,
  },
  backBtnText: {
    color: '#090D16',
    fontWeight: '800',
  },
});
