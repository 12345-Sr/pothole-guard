import { create } from 'zustand';
import { LocationReading, DEFAULT_COORDINATES, locationService } from '../services/locationService';

interface LocationState {
  currentLocation: LocationReading;
  isWatching: boolean;
  hasPermission: boolean;
  setPermission: (granted: boolean) => void;
  updateLocation: (reading: LocationReading) => void;
  startTracking: (simulate?: boolean) => void;
  stopTracking: () => void;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  currentLocation: {
    latitude: DEFAULT_COORDINATES.latitude,
    longitude: DEFAULT_COORDINATES.longitude,
    accuracy: 4.2,
    speed: 34.0,
    heading: 95,
    altitude: 124,
    timestamp: new Date().toISOString(),
    isAccuracyLow: false,
    roadName: 'Grand Trunk Road',
    city: 'Kanpur',
    state: 'Uttar Pradesh',
    country: 'India',
  },
  isWatching: false,
  hasPermission: false,

  setPermission: (granted: boolean) => set({ hasPermission: granted }),

  updateLocation: (reading: LocationReading) => set({ currentLocation: reading }),

  startTracking: (simulate: boolean = false) => {
    if (get().isWatching) return;
    set({ isWatching: true });

    locationService.startWatching((reading) => {
      set({ currentLocation: reading });
    }, simulate);
  },

  stopTracking: () => {
    locationService.stopWatching();
    set({ isWatching: false });
  },
}));
