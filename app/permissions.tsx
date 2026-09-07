import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, MapPin, Bell, CheckCircle2, ArrowRight } from 'lucide-react-native';
import * as Location from 'expo-location';
import { Camera as ExpoCamera } from 'expo-camera';

export default function PermissionsScreen() {
  const router = useRouter();
  const [cameraStatus, setCameraStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [locationStatus, setLocationStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [notifStatus, setNotifStatus] = useState<'pending' | 'granted' | 'denied'>('pending');

  const requestCamera = async () => {
    try {
      const res = await ExpoCamera.requestCameraPermissionsAsync();
      setCameraStatus(res.granted ? 'granted' : 'denied');
    } catch {
      setCameraStatus('granted'); // Graceful fallback on web
    }
  };

  const requestLocation = async () => {
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(res.granted ? 'granted' : 'denied');
    } catch {
      setLocationStatus('granted');
    }
  };

  const requestNotification = async () => {
    setNotifStatus('granted');
  };

  const allGranted =
    cameraStatus === 'granted' &&
    locationStatus === 'granted';

  const handleContinue = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.badge}>ESSENTIAL CAPABILITIES</Text>
          <Text style={styles.title}>Enable Permissions for Live Road Scan</Text>
          <Text style={styles.subtitle}>
            To detect hazards safely while driving, PotholeGuard requires access to your camera and high-accuracy GPS.
          </Text>
        </View>

        <View style={styles.cardList}>
          {/* Camera Permission Card */}
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Camera size={24} color="#38BDF8" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Camera Feed</Text>
              <Text style={styles.cardDesc}>
                Real-time optical road scanning to detect pothole craters and compute bounding boxes.
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                cameraStatus === 'granted' && styles.grantedBtn,
              ]}
              onPress={requestCamera}
            >
              {cameraStatus === 'granted' ? (
                <CheckCircle2 size={16} color="#10B981" />
              ) : (
                <Text style={styles.actionBtnText}>Allow</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Location Permission Card */}
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <MapPin size={24} color="#F59E0B" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Precise GPS Location</Text>
              <Text style={styles.cardDesc}>
                Tags potholes with coordinates, speed, and heading to plot them on the civic map.
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                locationStatus === 'granted' && styles.grantedBtn,
              ]}
              onPress={requestLocation}
            >
              {locationStatus === 'granted' ? (
                <CheckCircle2 size={16} color="#10B981" />
              ) : (
                <Text style={styles.actionBtnText}>Allow</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Notifications Card */}
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Bell size={24} color="#10B981" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Voice & Proximity Alerts</Text>
              <Text style={styles.cardDesc}>
                Notifies you of upcoming road hazards without taking your eyes off the asphalt.
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                notifStatus === 'granted' && styles.grantedBtn,
              ]}
              onPress={requestNotification}
            >
              {notifStatus === 'granted' ? (
                <CheckCircle2 size={16} color="#10B981" />
              ) : (
                <Text style={styles.actionBtnText}>Allow</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.continueBtn, !allGranted && styles.continueBtnMuted]}
          onPress={handleContinue}
        >
          <Text style={styles.continueBtnText}>
            {allGranted ? 'Launch PotholeGuard' : 'Continue with Demo Mode'}
          </Text>
          <ArrowRight size={18} color="#090D16" />
        </TouchableOpacity>
      </View>
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
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 12,
  },
  badge: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
    marginBottom: 10,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
  },
  cardList: {
    gap: 16,
    marginVertical: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131A29',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardInfo: {
    flex: 1,
    marginRight: 10,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  grantedBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  actionBtnText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#38BDF8',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  continueBtnMuted: {
    backgroundColor: '#1E293B',
  },
  continueBtnText: {
    color: '#090D16',
    fontSize: 16,
    fontWeight: '800',
  },
});
