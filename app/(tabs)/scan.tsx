import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Image,
  Platform,
} from 'react-native';
import { useScanStore } from '../../stores/scanStore';
import { useLocationStore } from '../../stores/locationStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { usePotholeStore } from '../../stores/potholeStore';
import { DetectionOverlay } from '../../components/DetectionOverlay';
import { formatSpeed, formatAccuracy } from '../../utils/formatters';
import { cameraService } from '../../services/cameraService';
import { detectionService } from '../../services/detectionService';
import { realtimeCameraVision } from '../../ml/RealtimeCameraVision';
import { sharePothole } from '../../services/sharingService';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { TripSummaryModal } from '../../components/TripSummaryModal';
import {
  Square,
  Play,
  Volume2,
  VolumeX,
  Radio,
  Gauge,
  Crosshair,
  ShieldCheck,
  Camera,
  CheckCircle,
  Bike,
  Sparkles,
  Zap,
  Share2,
  Flag,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LiveScanScreen() {
  const {
    isScanning,
    activeDetection,
    lastConfirmedPothole,
    showAlert,
    totalScanDetections,
    startPoint,
    sessionDistanceMeters,
    lastCompletedTrip,
    showTripSummaryModal,
    startLiveScan,
    stopLiveScan,
    closeTripSummary,
  } = useScanStore();

  const addPothole = usePotholeStore((s) => s.addPothole);
  const currentLocation = useLocationStore((s) => s.currentLocation);
  const { audioAlerts, toggleAudio, isDemoMode, toggleDemoMode } = useSettingsStore();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Native camera permission
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Setup Web real hardware camera
  useEffect(() => {
    if (Platform.OS === 'web' && isScanning) {
      startWebCamera();
    } else if (Platform.OS === 'web' && !isScanning) {
      stopWebCamera();
    }
    return () => {
      stopWebCamera();
    };
  }, [isScanning]);

  const startWebCamera = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          cameraService.setVideoElement(videoRef.current);
          setCameraActive(true);
        }
      }
    } catch (err: any) {
      console.warn('Real webcam access error:', err);
      setCameraError('Camera access required. Please allow browser camera access.');
    }
  };

  const stopWebCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  // Trigger camera shutter flash whenever a confirmed detection alert occurs
  useEffect(() => {
    if (showAlert) {
      triggerShutter();
    }
  }, [showAlert]);

  // Manual Instant Snapshot Trigger (for point-and-scan)
  const handleManualCapture = async () => {
    triggerShutter();
    const snapshotUri = await cameraService.captureEvidenceSnapshot({
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      timestamp: new Date().toISOString(),
      speed: currentLocation.speed,
    });

    const newPothole = {
      id: `pot-manual-${Date.now()}`,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      confidence: 0.96,
      severity: 'high' as const,
      status: 'confirmed' as const,
      imageUrl: snapshotUri,
      detectionTimestamp: new Date().toISOString(),
      reportedBy: 'Rider Manual Scan',
      roadName: currentLocation.roadName || 'Current Road',
      city: currentLocation.city || 'Local Area',
      state: currentLocation.state || '',
      country: 'India',
      speedAtDetection: currentLocation.speed,
      heading: currentLocation.heading,
      gpsAccuracy: currentLocation.accuracy,
      voteCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addPothole(newPothole);
  };

  const triggerShutter = () => {
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 250);
  };

  // Bike ride recording elapsed timer
  useEffect(() => {
    let timer: any;
    if (isScanning) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isScanning]);

  const handleToggleScan = async () => {
    if (isScanning) {
      await stopLiveScan();
    } else {
      if (!permission?.granted && Platform.OS !== 'web') {
        await requestPermission();
      }
      await startLiveScan();
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Minimal HUD Header */}
        <View style={styles.topHud}>
          <View style={styles.hudBadge}>
            <View style={[styles.pulseDot, isScanning && styles.pulseDotActive]} />
            <Text style={styles.hudTitle}>
              {isScanning ? `LIVE CAMERA REC [${formatTimer(elapsedSeconds)}]` : 'CAMERA STANDBY'}
            </Text>
          </View>

          <View style={styles.topRightControls}>
            {/* Mode Switcher: Real Camera AI vs Demo Simulation */}
            <TouchableOpacity
              style={[styles.modeBadge, isDemoMode ? styles.modeBadgeDemo : styles.modeBadgeReal]}
              onPress={async () => {
                const nextDemo = !isDemoMode;
                await toggleDemoMode();
                detectionService.setScanMode(nextDemo ? 'demo' : 'real');
              }}
              activeOpacity={0.7}
            >
              {isDemoMode ? (
                <>
                  <Sparkles size={12} color="#F59E0B" />
                  <Text style={styles.modeTextDemo}>DEMO SIM</Text>
                </>
              ) : (
                <>
                  <ShieldCheck size={12} color="#10B981" />
                  <Text style={styles.modeTextReal}>REAL AI</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.bikeModeBadge}>
              <Bike size={14} color="#F59E0B" />
              <Text style={styles.bikeModeText}>RIDE</Text>
            </View>

            <TouchableOpacity style={styles.iconButton} onPress={toggleAudio}>
              {audioAlerts ? (
                <Volume2 size={18} color="#38BDF8" />
              ) : (
                <VolumeX size={18} color="#64748B" />
              )}
            </TouchableOpacity>

            <View style={styles.gpsIndicator}>
              <Radio size={14} color="#10B981" />
              <Text style={styles.gpsIndicatorText}>GPS ACTIVE</Text>
            </View>
          </View>
        </View>

        {/* Real Live Hardware Camera Viewport */}
        <View style={styles.viewportContainer}>
          {/* Shutter White Flash Animation when screenshot is captured */}
          {shutterFlash && <View style={styles.shutterFlashOverlay} pointerEvents="none" />}

          {/* Web: Mount HTML5 video dynamically without breaking native JSX */}
          {Platform.OS === 'web' ? (
            <View style={StyleSheet.absoluteFill}>
              {React.createElement('video', {
                ref: videoRef,
                autoPlay: true,
                playsInline: true,
                muted: true,
                style: {
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  backgroundColor: '#000',
                },
              })}
              {!isScanning && (
                <View style={styles.cameraPlaceholder}>
                  <Camera size={48} color="#38BDF8" />
                  <Text style={styles.placeholderTitle}>Live Hardware Camera Ready</Text>
                  <Text style={styles.placeholderSub}>
                    Tap 'START LIVE CAMERA SCAN' below to open your camera and scan the real road.
                  </Text>
                </View>
              )}
            </View>
          ) : permission?.granted ? (
            /* Mobile: Mount native CameraView */
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              ref={cameraRef}
            />
          ) : (
            <View style={styles.cameraPlaceholder}>
              <Camera size={48} color="#38BDF8" />
              <Text style={styles.placeholderTitle}>Camera Permission Required</Text>
              <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
                <Text style={styles.grantBtnText}>Grant Camera Permission</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Computer Vision Detection Bounding Box Overlay */}
          <DetectionOverlay
            detection={activeDetection}
            lastConfirmedPothole={lastConfirmedPothole}
            showAlert={showAlert}
            containerWidth={SCREEN_WIDTH - 32}
            containerHeight={420}
          />

          {/* Real-Time Live Hardware GPS Coordinates Ticker */}
          <View style={styles.liveCoordinatesTicker}>
            <View style={styles.liveDot} />
            <Text style={styles.liveCoordinatesText}>
              REAL GPS: {currentLocation.latitude.toFixed(6)}° N, {currentLocation.longitude.toFixed(6)}° E
            </Text>
          </View>

          {/* Live Point A Origin & Route Potholes Counter */}
          {isScanning && startPoint && (
            <View style={styles.pointABanner}>
              <View style={styles.pointABannerLeft}>
                <View style={styles.pointADot} />
                <Text style={styles.pointABannerText} numberOfLines={1}>
                  From Point A: {startPoint.roadName || 'Origin'} ({startPoint.latitude.toFixed(4)}°, {startPoint.longitude.toFixed(4)}°)
                </Text>
              </View>
              <View style={styles.pointABannerBadge}>
                <Text style={styles.pointABannerBadgeText}>
                  ⚠️ {totalScanDetections} Potholes • {(sessionDistanceMeters / 1000).toFixed(1)} km
                </Text>
              </View>
            </View>
          )}

          {/* Minimalist Live Telemetry Floating Pill */}
          <View style={styles.floatingTelemetry}>
            <View style={styles.telemetryItem}>
              <Gauge size={14} color="#38BDF8" />
              <Text style={styles.telemetryValue}>{formatSpeed(currentLocation.speed)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.telemetryItem}>
              <Crosshair size={14} color="#94A3B8" />
              <Text style={styles.telemetryValue}>
                {formatAccuracy(currentLocation.accuracy)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.telemetryItem}>
              <ShieldCheck size={14} color="#10B981" />
              <Text style={styles.telemetryValue}>
                {totalScanDetections} Hazards
              </Text>
            </View>
          </View>

          {/* Instant Manual Snapshot Trigger Button (Floats right above telemetry) */}
          {isScanning && (
            <TouchableOpacity
              style={styles.instantScanTrigger}
              onPress={handleManualCapture}
              activeOpacity={0.8}
            >
              <Zap size={16} color="#090D16" />
              <Text style={styles.instantScanText}>SCAN & RECORD THIS SPOT</Text>
            </TouchableOpacity>
          )}

          {/* Automatic Screenshot Capture Preview Card */}
          {lastConfirmedPothole && showAlert && (
            <View style={styles.snapshotNotificationCard}>
              <Image
                source={{ uri: lastConfirmedPothole.imageUrl }}
                style={styles.snapshotThumbnail}
              />
              <View style={styles.snapshotDetails}>
                <View style={styles.snapshotHeader}>
                  <Camera size={14} color="#10B981" />
                  <Text style={styles.snapshotTitle}>SCREENSHOT CAPTURED</Text>
                </View>
                <Text style={styles.snapshotCoords}>
                  📍 {lastConfirmedPothole.latitude.toFixed(6)}°, {lastConfirmedPothole.longitude.toFixed(6)}°
                </Text>
                <Text style={styles.snapshotStatus}>
                  Saved to SQLite DB & Dispatched
                </Text>
              </View>
              <TouchableOpacity
                style={styles.shareSnapshotBtn}
                onPress={() => sharePothole(lastConfirmedPothole)}
                activeOpacity={0.8}
              >
                <Share2 size={13} color="#090D16" />
                <Text style={styles.shareSnapshotText}>SHARE</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Bottom Bike Safety Controls (Large Touch Target) */}
        <View style={styles.bottomControls}>
          <TouchableOpacity
            style={[
              styles.scanActionButton,
              isScanning ? styles.stopButton : styles.startButton,
            ]}
            onPress={handleToggleScan}
            activeOpacity={0.88}
          >
            {isScanning ? (
              <>
                <Square size={20} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>STOP CAMERA SCAN</Text>
              </>
            ) : (
              <>
                <Play size={20} color="#090D16" />
                <Text style={[styles.actionBtnText, { color: '#090D16' }]}>
                  START LIVE CAMERA SCAN
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.safetyHint}>
            🏍️ Mount on bike handlebar. Camera continuously scans, screenshots & tags GPS automatically.
          </Text>
        </View>
      </View>

      {/* Point A to Point B Trip Summary Report Modal */}
      <TripSummaryModal
        trip={lastCompletedTrip}
        visible={showTripSummaryModal}
        onClose={closeTripSummary}
      />
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
    padding: 16,
    justifyContent: 'space-between',
  },
  topHud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  hudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131A29',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#64748B',
  },
  pulseDotActive: {
    backgroundColor: '#EF4444',
  },
  hudTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  topRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  modeBadgeReal: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  modeBadgeDemo: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
  },
  modeTextReal: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  modeTextDemo: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
  },
  bikeModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  bikeModeText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
  },
  iconButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#131A29',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  gpsIndicatorText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
  },
  viewportContainer: {
    height: 440,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#020617',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    position: 'relative',
    marginVertical: 12,
  },
  shutterFlashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 99,
  },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#0f172a',
  },
  placeholderTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  placeholderSub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  grantBtn: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  grantBtnText: {
    color: '#090D16',
    fontWeight: '800',
  },
  liveCoordinatesTicker: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    gap: 8,
    zIndex: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  liveCoordinatesText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pointABanner: {
    position: 'absolute',
    top: 50,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    gap: 8,
    zIndex: 20,
  },
  pointABannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  pointADot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  pointABannerText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    flex: 1,
  },
  pointABannerBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pointABannerBadgeText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '800',
  },
  instantScanTrigger: {
    position: 'absolute',
    bottom: 74,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    zIndex: 25,
  },
  instantScanText: {
    color: '#090D16',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  floatingTelemetry: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    zIndex: 20,
  },
  telemetryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  telemetryValue: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: '#334155',
  },
  snapshotNotificationCard: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderColor: '#10B981',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 10,
    gap: 12,
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  snapshotThumbnail: {
    width: 60,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#000',
  },
  snapshotDetails: {
    flex: 1,
  },
  snapshotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  snapshotTitle: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  snapshotCoords: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  snapshotStatus: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  shareSnapshotBtn: {
    backgroundColor: '#38BDF8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'center',
  },
  shareSnapshotText: {
    color: '#090D16',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bottomControls: {
    paddingBottom: Platform.OS === 'ios' ? 90 : 70,
    alignItems: 'center',
  },
  scanActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
  },
  startButton: {
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.4,
  },
  stopButton: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 0.4,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  safetyHint: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
});
