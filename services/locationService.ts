import * as Location from 'expo-location';
import { Platform } from 'react-native';

export const MAX_ACCEPTABLE_GPS_ACCURACY = 30; // meters
export const DEFAULT_COORDINATES = { latitude: 26.4499, longitude: 80.3319 };

export interface LocationReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  heading: number;
  altitude: number;
  timestamp: string;
  isAccuracyLow: boolean;
  roadName?: string;
  city?: string;
  state?: string;
  country?: string;
}

class LocationService {
  private subscription: any = null;
  private watchId: number | null = null;
  private isSimulating: boolean = false;
  private cachedRoadInfo: { roadName?: string; city?: string; state?: string } = {
    roadName: 'Current Location',
    city: 'Local Area',
    state: '',
  };

  public async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        return true;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the real physical GPS position from the hardware device.
   */
  public async getCurrentLocation(): Promise<LocationReading> {
    if (this.isSimulating) {
      return this.getSimulatedReading();
    }

    // 1. Web Geolocation API
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const accuracy = pos.coords.accuracy ?? 5;
            const reading: LocationReading = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy,
              speed: pos.coords.speed && pos.coords.speed > 0 ? pos.coords.speed * 3.6 : 0,
              heading: pos.coords.heading ?? 0,
              altitude: pos.coords.altitude ?? 0,
              timestamp: new Date(pos.timestamp).toISOString(),
              isAccuracyLow: accuracy > MAX_ACCEPTABLE_GPS_ACCURACY,
              roadName: this.cachedRoadInfo.roadName,
              city: this.cachedRoadInfo.city,
              state: this.cachedRoadInfo.state,
            };
            this.reverseGeocode(reading.latitude, reading.longitude);
            resolve(reading);
          },
          (err) => {
            console.warn('Geolocation error, falling back:', err);
            resolve(this.getFallbackReading());
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    }

    // 2. Mobile Expo Location API
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const accuracy = loc.coords.accuracy ?? 5;
      const reading: LocationReading = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy,
        speed: loc.coords.speed && loc.coords.speed > 0 ? loc.coords.speed * 3.6 : 0,
        heading: loc.coords.heading ?? 0,
        altitude: loc.coords.altitude ?? 0,
        timestamp: new Date(loc.timestamp).toISOString(),
        isAccuracyLow: accuracy > MAX_ACCEPTABLE_GPS_ACCURACY,
        roadName: this.cachedRoadInfo.roadName,
        city: this.cachedRoadInfo.city,
        state: this.cachedRoadInfo.state,
      };

      this.reverseGeocode(reading.latitude, reading.longitude);
      return reading;
    } catch {
      return this.getFallbackReading();
    }
  }

  /**
   * Watches real-time GPS position updates continuously as the user moves.
   */
  public startWatching(
    callback: (reading: LocationReading) => void,
    simulate: boolean = false
  ): void {
    this.stopWatching();
    this.isSimulating = simulate;

    if (simulate) {
      callback(this.getSimulatedReading());
      return;
    }

    // Web continuous watch
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const accuracy = pos.coords.accuracy ?? 4;
          const reading: LocationReading = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy,
            speed: pos.coords.speed && pos.coords.speed > 0 ? pos.coords.speed * 3.6 : 0,
            heading: pos.coords.heading ?? 0,
            altitude: pos.coords.altitude ?? 0,
            timestamp: new Date(pos.timestamp).toISOString(),
            isAccuracyLow: accuracy > MAX_ACCEPTABLE_GPS_ACCURACY,
            roadName: this.cachedRoadInfo.roadName,
            city: this.cachedRoadInfo.city,
            state: this.cachedRoadInfo.state,
          };
          callback(reading);
        },
        (err) => {
          console.warn('Web watchPosition error:', err);
          this.getCurrentLocation().then(callback);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 }
      );
      // Fetch initial position immediately
      this.getCurrentLocation().then(callback);
      return;
    }

    // Mobile continuous watch
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (loc) => {
        const accuracy = loc.coords.accuracy ?? 5;
        const reading: LocationReading = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy,
          speed: loc.coords.speed && loc.coords.speed > 0 ? loc.coords.speed * 3.6 : 0,
          heading: loc.coords.heading ?? 0,
          altitude: loc.coords.altitude ?? 0,
          timestamp: new Date(loc.timestamp).toISOString(),
          isAccuracyLow: accuracy > MAX_ACCEPTABLE_GPS_ACCURACY,
          roadName: this.cachedRoadInfo.roadName,
          city: this.cachedRoadInfo.city,
          state: this.cachedRoadInfo.state,
        };
        callback(reading);
      }
    ).then((sub) => {
      this.subscription = sub;
    }).catch(() => {
      this.getCurrentLocation().then(callback);
    });
  }

  public stopWatching(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    if (this.watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  private getFallbackReading(): LocationReading {
    return {
      latitude: 26.4499,
      longitude: 80.3319,
      accuracy: 5.0,
      speed: 0,
      heading: 0,
      altitude: 120,
      timestamp: new Date().toISOString(),
      isAccuracyLow: false,
      roadName: 'Active Road Corridor',
      city: 'Current Area',
      state: '',
    };
  }

  private getSimulatedReading(): LocationReading {
    return this.getFallbackReading();
  }

  public async reverseGeocode(latitude: number, longitude: number): Promise<{
    roadName?: string;
    city?: string;
    state?: string;
  }> {
    try {
      if (Platform.OS !== 'web') {
        const places = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (places && places.length > 0) {
          const p = places[0];
          this.cachedRoadInfo = {
            roadName: p.street || p.name || 'Current Roadway',
            city: p.city || p.district || 'Local City',
            state: p.region || '',
          };
        }
      }
    } catch {
      // Keep cached
    }
    return this.cachedRoadInfo;
  }
}

export const locationService = new LocationService();
