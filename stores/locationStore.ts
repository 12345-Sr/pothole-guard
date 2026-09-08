import { create } from 'zustand';
import { LocationReading, DEFAULT_COORDINATES, locationService, GpsStatus } from '../services/locationService';

interface LocationState {
  currentLocation: LocationReading;
  isWatching: boolean;
  hasPermission: boolean;
  isGpsLocked: boolean;
  gpsStatus: GpsStatus;
  setPermission: (granted: boolean) => void;
  updateLocation: (reading: LocationReading) => void;
  startTracking: (simulate?: boolean) => void;
  stopTracking: () => void;
  requestGpsPermission: () => Promise<boolean>;
  refreshLocation: () => Promise<LocationReading>;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  currentLocation: {
    latitude: DEFAULT_COORDINATES.latitude,
    longitude: DEFAULT_COORDINATES.longitude,
    accuracy: 25.0,
    speed: 0,
    heading: 0,
    altitude: 0,
    timestamp: new Date().toISOString(),
    isAccuracyLow: true,
    roadName: 'Acquiring GPS...',
    city: 'Detecting Location...',
    state: '',
    country: '',
  },
  isWatching: false,
  hasPermission: false,
  isGpsLocked: false,
  gpsStatus: 'acquiring',

  setPermission: (granted: boolean) => set({ hasPermission: granted }),

  updateLocation: (reading: LocationReading) =>
    set({
      currentLocation: reading,
      isGpsLocked: true,
      gpsStatus: 'locked',
    }),

  startTracking: (simulate: boolean = false) => {
    if (get().isWatching) return;
    set({ isWatching: true });

    locationService.subscribeStatus((status) => {
      set({
        gpsStatus: status,
        isGpsLocked: status === 'locked',
        hasPermission: status !== 'denied',
      });
    });

    locationService.startWatching((reading) => {
      set({
        currentLocation: reading,
        isGpsLocked: true,
        gpsStatus: 'locked',
      });
    }, simulate);
  },

  stopTracking: () => {
    locationService.stopWatching();
    set({ isWatching: false });
  },

  requestGpsPermission: async () => {
    const granted = await locationService.requestPermissions();
    set({
      hasPermission: granted,
      gpsStatus: granted ? 'acquiring' : 'denied',
    });
    if (granted) {
      get().startTracking(false);
    }
    return granted;
  },

  refreshLocation: async () => {
    const loc = await locationService.getCurrentLocation();
    set({
      currentLocation: loc,
      isGpsLocked: locationService.getStatus() === 'locked',
      gpsStatus: locationService.getStatus(),
    });
    return loc;
  },
}));
