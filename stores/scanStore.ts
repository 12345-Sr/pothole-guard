import { create } from 'zustand';
import { DetectionResult } from '../models/Detection';
import { Pothole } from '../models/Pothole';
import { TripPoint, TripSession, RoadQualityRating } from '../models/Session';
import { detectionService } from '../services/detectionService';
import { useLocationStore } from './locationStore';
import { usePotholeStore } from './potholeStore';
import { useSettingsStore } from './settingsStore';
import { calculateDistance } from '../utils/haversine';

const BACKEND_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.1.40:8000';

interface ScanState {
  isScanning: boolean;
  activeDetection: DetectionResult | null;
  lastConfirmedPothole: Pothole | null;
  showAlert: boolean;
  totalScanDetections: number;
  scanStartTime: number | null;

  // Point A to Point B Trip Session Tracking
  startPoint: TripPoint | null;
  currentPoint: TripPoint | null;
  endPoint: TripPoint | null;
  sessionPotholes: Pothole[];
  sessionDistanceMeters: number;
  lastCompletedTrip: TripSession | null;
  showTripSummaryModal: boolean;

  startLiveScan: () => Promise<void>;
  stopLiveScan: () => Promise<TripSession | null>;
  dismissAlert: () => void;
  setShowTripSummaryModal: (show: boolean) => void;
  closeTripSummary: () => void;
  addSessionPothole: (pothole: Pothole) => void;
}

let unsubscribeDetection: (() => void) | null = null;
let locationUnsubscribe: (() => void) | null = null;
let lastWaypoint: { latitude: number; longitude: number } | null = null;

export const useScanStore = create<ScanState>((set, get) => ({
  isScanning: false,
  activeDetection: null,
  lastConfirmedPothole: null,
  showAlert: false,
  totalScanDetections: 0,
  scanStartTime: null,

  startPoint: null,
  currentPoint: null,
  endPoint: null,
  sessionPotholes: [],
  sessionDistanceMeters: 0,
  lastCompletedTrip: null,
  showTripSummaryModal: false,

  startLiveScan: async () => {
    if (get().isScanning) return;

    const startLoc = useLocationStore.getState().currentLocation;
    const nowIso = new Date().toISOString();
    const startPoint: TripPoint = {
      latitude: startLoc.latitude,
      longitude: startLoc.longitude,
      timestamp: nowIso,
      roadName: startLoc.roadName || 'Point A',
      city: startLoc.city || 'Kanpur',
    };

    lastWaypoint = {
      latitude: startLoc.latitude,
      longitude: startLoc.longitude,
    };

    set({
      isScanning: true,
      scanStartTime: Date.now(),
      totalScanDetections: 0,
      activeDetection: null,
      lastConfirmedPothole: null,
      showAlert: false,
      startPoint,
      currentPoint: startPoint,
      sessionPotholes: [],
      sessionDistanceMeters: 0,
      showTripSummaryModal: false,
    });

    if (unsubscribeDetection) {
      unsubscribeDetection();
    }
    if (locationUnsubscribe) {
      locationUnsubscribe();
    }

    // Subscribe to location changes to accumulate ride distance from Point A
    locationUnsubscribe = useLocationStore.subscribe((locState) => {
      if (!get().isScanning || !lastWaypoint) return;
      const cur = locState.currentLocation;
      const d = calculateDistance(
        lastWaypoint.latitude,
        lastWaypoint.longitude,
        cur.latitude,
        cur.longitude
      );

      // Accumulate if moved at least 6 meters
      if (d >= 6) {
        lastWaypoint = { latitude: cur.latitude, longitude: cur.longitude };
        set((s) => ({
          sessionDistanceMeters: s.sessionDistanceMeters + d,
          currentPoint: {
            latitude: cur.latitude,
            longitude: cur.longitude,
            timestamp: new Date().toISOString(),
            roadName: cur.roadName,
            city: cur.city,
          },
        }));
      }
    });

    unsubscribeDetection = detectionService.subscribe((event) => {
      if (event.type === 'frame_detection' && event.detection) {
        set({ activeDetection: event.detection });
      } else if (event.type === 'confirmed_pothole' && event.pothole) {
        // Feed into pothole store (duplicate check runs inside addPothole)
        const result = usePotholeStore.getState().addPothole(event.pothole);

        set((state) => ({
          lastConfirmedPothole: result.pothole,
          showAlert: true,
          totalScanDetections: state.totalScanDetections + 1,
          sessionPotholes: [result.pothole, ...state.sessionPotholes],
        }));

        // Auto dismiss visual warning after 3.5 seconds so driver isn't distracted
        setTimeout(() => {
          set({ showAlert: false });
        }, 3500);
      }
    });

    const isDemo = useSettingsStore.getState().isDemoMode;
    detectionService.setScanMode(isDemo ? 'demo' : 'real');
    await detectionService.startScan(() => useLocationStore.getState().currentLocation);
  },

  stopLiveScan: async () => {
    if (!get().isScanning) return null;

    await detectionService.stopScan();
    if (unsubscribeDetection) {
      unsubscribeDetection();
      unsubscribeDetection = null;
    }
    if (locationUnsubscribe) {
      locationUnsubscribe();
      locationUnsubscribe = null;
    }

    const endLoc = useLocationStore.getState().currentLocation;
    const nowIso = new Date().toISOString();
    const endPoint: TripPoint = {
      latitude: endLoc.latitude,
      longitude: endLoc.longitude,
      timestamp: nowIso,
      roadName: endLoc.roadName || 'Point B',
      city: endLoc.city || 'Kanpur',
    };

    const startPoint = get().startPoint || endPoint;
    const straightLine = calculateDistance(
      startPoint.latitude,
      startPoint.longitude,
      endPoint.latitude,
      endPoint.longitude
    );

    const totalMeters = Math.max(get().sessionDistanceMeters, straightLine);
    const distanceKm = Number((totalMeters / 1000).toFixed(2));
    const startTime = get().scanStartTime || Date.now();
    const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const avgSpeed =
      distanceKm > 0
        ? Number(((distanceKm / (durationSeconds / 3600))).toFixed(1))
        : endLoc.speed || 0.0;

    const sessionPotholes = get().sessionPotholes;
    const count = sessionPotholes.length;

    // Severity breakdown
    const severityBreakdown = {
      critical: sessionPotholes.filter((p) => p.severity === 'critical').length,
      high: sessionPotholes.filter((p) => p.severity === 'high').length,
      medium: sessionPotholes.filter((p) => p.severity === 'medium').length,
      low: sessionPotholes.filter((p) => p.severity === 'low').length,
    };

    // Calculate Road Quality Rating based on pothole density
    const density = distanceKm > 0 ? count / distanceKm : count;
    let roadQuality: RoadQualityRating = 'EXCELLENT';
    if (count === 0) {
      roadQuality = 'EXCELLENT';
    } else if (density <= 0.5) {
      roadQuality = 'GOOD';
    } else if (density <= 1.5) {
      roadQuality = 'FAIR';
    } else if (density <= 3.0) {
      roadQuality = 'POOR';
    } else {
      roadQuality = 'HAZARDOUS';
    }

    const tripSession: TripSession = {
      id: `trip-${Date.now().toString(36)}`,
      startedAt: startPoint.timestamp,
      endedAt: endPoint.timestamp,
      startPoint,
      endPoint,
      potholesCount: count,
      potholes: sessionPotholes,
      distanceKm,
      durationSeconds,
      averageSpeedKmh: avgSpeed,
      severityBreakdown,
      roadQuality,
    };

    // Save trip to SQLite backend asynchronously
    fetch(`${BACKEND_BASE}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tripSession),
    }).catch((e) => console.log('Trip upload offline:', e));

    set({
      isScanning: false,
      activeDetection: null,
      showAlert: false,
      endPoint,
      lastCompletedTrip: tripSession,
      showTripSummaryModal: true,
    });

    return tripSession;
  },

  addSessionPothole: (pothole: Pothole) => {
    set((state) => ({
      totalScanDetections: state.totalScanDetections + 1,
      lastConfirmedPothole: pothole,
      showAlert: true,
      sessionPotholes: [pothole, ...state.sessionPotholes],
    }));
  },

  dismissAlert: () => set({ showAlert: false }),
  setShowTripSummaryModal: (show: boolean) => set({ showTripSummaryModal: show }),
  closeTripSummary: () => set({ showTripSummaryModal: false }),
}));

