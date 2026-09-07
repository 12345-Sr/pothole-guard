import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { usePotholeStore } from '../../stores/potholeStore';
import { useLocationStore } from '../../stores/locationStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { StatCard } from '../../components/StatCard';
import { SafetyBanner } from '../../components/SafetyBanner';
import { SeverityBadge } from '../../components/SeverityBadge';
import { formatDate } from '../../utils/formatters';
import {
  Scan,
  MapPin,
  ShieldCheck,
  AlertCircle,
  PlusCircle,
  Clock,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';

export default function HomeScreen() {
  const router = useRouter();
  const potholes = usePotholeStore((s) => s.potholes);
  const currentLocation = useLocationStore((s) => s.currentLocation);
  const isDemoMode = useSettingsStore((s) => s.isDemoMode);

  // Compute metrics
  const confirmedCount = potholes.filter((p) => p.status === 'confirmed').length;
  const detectedCount = potholes.length;
  const recentReports = potholes.slice(0, 4);

  // Road safety index (computed from potholes density)
  const safetyScore = Math.max(68, 98 - potholes.length * 2);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Top Greeting & Location Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.headerSub}>Drive safely today</Text>
          </View>

          {isDemoMode && (
            <View style={styles.demoPill}>
              <Sparkles size={12} color="#F59E0B" />
              <Text style={styles.demoText}>Demo Mode</Text>
            </View>
          )}
        </View>

        {/* Current Road & GPS Location Bar */}
        <View style={styles.locationBar}>
          <MapPin size={16} color="#38BDF8" />
          <Text style={styles.locationText} numberOfLines={1}>
            {currentLocation.roadName || 'Grand Trunk Road'}, {currentLocation.city || 'Kanpur'}
          </Text>
          <View style={styles.gpsBadge}>
            <View style={styles.gpsDot} />
            <Text style={styles.gpsText}>GPS ±{Math.round(currentLocation.accuracy)}m</Text>
          </View>
        </View>

        {/* Safety Disclaimer Banner */}
        <SafetyBanner compact />

        {/* Primary CTA: START LIVE SCAN */}
        <TouchableOpacity
          style={styles.primaryCta}
          activeOpacity={0.88}
          onPress={() => router.push('/(tabs)/scan')}
        >
          <View style={styles.ctaIconContainer}>
            <Scan size={32} color="#090D16" />
          </View>
          <View style={styles.ctaTextContainer}>
            <Text style={styles.ctaTitle}>START LIVE SCAN</Text>
            <Text style={styles.ctaSubtitle}>
              Hands-free optical road analysis & real-time hazard detection
            </Text>
          </View>
        </TouchableOpacity>

        {/* Dashboard Stat Cards */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Nearby Hazards"
            value={potholes.length}
            icon={<AlertCircle size={16} color="#F59E0B" />}
            color="#F59E0B"
            subtitle="Within 5 km"
          />
          <StatCard
            label="Confirmed"
            value={confirmedCount}
            icon={<ShieldCheck size={16} color="#10B981" />}
            color="#10B981"
            subtitle="Citizen verified"
          />
          <StatCard
            label="Road Safety"
            value={`${safetyScore}/100`}
            color="#38BDF8"
            subtitle="Safe Corridor"
          />
        </View>

        {/* Secondary Quick Action Buttons */}
        <View style={styles.secondaryActions}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/(tabs)/map')}
          >
            <MapPin size={18} color="#38BDF8" />
            <Text style={styles.secondaryBtnText}>View Live Map</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/(tabs)/report')}
          >
            <PlusCircle size={18} color="#10B981" />
            <Text style={styles.secondaryBtnText}>Manual Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/history')}
          >
            <Clock size={18} color="#A78BFA" />
            <Text style={styles.secondaryBtnText}>History</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Reports Feed */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Road Reports</Text>
          <TouchableOpacity onPress={() => router.push('/history')}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.reportsList}>
          {recentReports.map((pothole) => (
            <TouchableOpacity
              key={pothole.id}
              style={styles.reportCard}
              onPress={() => router.push(`/pothole/${pothole.id}`)}
            >
              <View style={styles.reportLeft}>
                <SeverityBadge severity={pothole.severity} size="sm" />
                <View style={styles.reportInfo}>
                  <Text style={styles.reportRoad} numberOfLines={1}>
                    {pothole.roadName || 'Road Hazard'}
                  </Text>
                  <Text style={styles.reportMeta}>
                    {formatDate(pothole.detectionTimestamp)} • {Math.round(pothole.confidence * 100)}% Conf
                  </Text>
                </View>
              </View>

              <View style={styles.reportRight}>
                <Text style={styles.reportVotes}>👍 {pothole.voteCount}</Text>
                <ChevronRight size={18} color="#64748B" />
              </View>
            </TouchableOpacity>
          ))}
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
  contentContainer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSub: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 2,
  },
  demoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  demoText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131A29',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 8,
  },
  locationText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gpsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  gpsText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#38BDF8',
    borderRadius: 20,
    padding: 18,
    marginVertical: 14,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaIconContainer: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  ctaTextContainer: {
    flex: 1,
  },
  ctaTitle: {
    color: '#090D16',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  ctaSubtitle: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.85,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 12,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#131A29',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
  },
  secondaryBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  seeAllText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  reportsList: {
    gap: 10,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#131A29',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
  },
  reportLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  reportInfo: {
    flex: 1,
  },
  reportRoad: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '700',
  },
  reportMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  reportRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportVotes: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
});
