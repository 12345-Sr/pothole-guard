import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { useSettingsStore } from '../../stores/settingsStore';
import { usePotholeStore } from '../../stores/potholeStore';
import { StatCard } from '../../components/StatCard';
import {
  User,
  Shield,
  Volume2,
  Sparkles,
  Sliders,
  Bell,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react-native';
import { syncService } from '../../services/syncService';

export default function ProfileScreen() {
  const {
    isDemoMode,
    audioAlerts,
    toggleDemoMode,
    toggleAudio,
    confidenceThreshold,
    updateSettings,
  } = useSettingsStore();

  const potholes = usePotholeStore((s) => s.potholes);
  const confirmedCount = potholes.filter((p) => p.status === 'confirmed').length;

  const handleManualSync = async () => {
    const res = await syncService.processQueue();
    alert(`Sync completed. Processed: ${res.processed}, Succeeded: ${res.succeeded}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <User size={32} color="#38BDF8" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>Citizen SafeDriver</Text>
            <Text style={styles.userRole}>Civic Road Guardian • Kanpur Node</Text>
          </View>
        </View>

        {/* Community Impact Stats */}
        <Text style={styles.sectionHeader}>COMMUNITY IMPACT</Text>
        <View style={styles.statsGrid}>
          <StatCard
            label="Detected"
            value={potholes.length}
            color="#38BDF8"
            subtitle="Hazards identified"
          />
          <StatCard
            label="Confirmed"
            value={confirmedCount}
            color="#10B981"
            subtitle="Citizen verified"
          />
          <StatCard
            label="Impact Pts"
            value={potholes.length * 25 + confirmedCount * 50}
            color="#F59E0B"
            subtitle="Civic points"
          />
        </View>

        {/* Driving & Audio Safety Settings */}
        <Text style={styles.sectionHeader}>SAFETY & PREFERENCES</Text>
        <View style={styles.settingsGroup}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Volume2 size={20} color="#38BDF8" />
              <View>
                <Text style={styles.settingTitle}>Voice Hazard Alerts</Text>
                <Text style={styles.settingDesc}>
                  Announce upcoming potholes through car speakers
                </Text>
              </View>
            </View>
            <Switch
              value={audioAlerts}
              onValueChange={toggleAudio}
              trackColor={{ false: '#1E293B', true: '#38BDF8' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Sliders size={20} color="#F59E0B" />
              <View>
                <Text style={styles.settingTitle}>AI Confidence Threshold</Text>
                <Text style={styles.settingDesc}>
                  Current filter: {Math.round(confidenceThreshold * 100)}%
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.pillButton}
              onPress={() => {
                const next = confidenceThreshold >= 0.85 ? 0.65 : confidenceThreshold + 0.1;
                updateSettings({ confidenceThreshold: Number(next.toFixed(2)) });
              }}
            >
              <Text style={styles.pillText}>{Math.round(confidenceThreshold * 100)}%</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Developer & Demo Mode */}
        <Text style={styles.sectionHeader}>DEVELOPER & SIMULATION</Text>
        <View style={styles.settingsGroup}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Sparkles size={20} color="#F59E0B" />
              <View>
                <Text style={styles.settingTitle}>Simulation Demo Mode</Text>
                <Text style={styles.settingDesc}>
                  Simulate live camera feed, GPS movement & pothole triggers
                </Text>
              </View>
            </View>
            <Switch
              value={isDemoMode}
              onValueChange={toggleDemoMode}
              trackColor={{ false: '#1E293B', true: '#F59E0B' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <TouchableOpacity style={styles.settingRow} onPress={handleManualSync}>
            <View style={styles.settingInfo}>
              <RefreshCw size={20} color="#10B981" />
              <View>
                <Text style={styles.settingTitle}>Offline Sync Queue</Text>
                <Text style={styles.settingDesc}>Synchronize local reports with backend</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* About App */}
        <Text style={styles.sectionHeader}>ABOUT</Text>
        <View style={styles.settingsGroup}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Info size={20} color="#64748B" />
              <View>
                <Text style={styles.settingTitle}>PotholeGuard v1.0.0</Text>
                <Text style={styles.settingDesc}>Civic Road AI & Safe Driving Platform</Text>
              </View>
            </View>
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
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131A29',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    marginBottom: 20,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  userRole: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
  },
  sectionHeader: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 18,
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  settingsGroup: {
    backgroundColor: '#131A29',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  settingDesc: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  pillButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pillText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '800',
  },
});
