import * as Location from 'expo-location';
import { Platform } from 'react-native';

export const MAX_ACCEPTABLE_GPS_ACCURACY = 30; // meters
export const DEFAULT_COORDINATES = { latitude: 26.4499, longitude: 80.3319 };

export type GpsStatus = 'acquiring' | 'locked' | 'denied' | 'error';

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
  private currentStatus: GpsStatus = 'acquiring';
  private statusListeners: Set<(status: GpsStatus) => void> = new Set();
  private lastValidReading: LocationReading | null = null;
  private geocodeCache = new Map<string, { roadName?: string; city?: string; state?: string; country?: string }>();
  private lastGeocodeRequestTime: number = 0;

  private cachedRoadInfo: { roadName?: string; city?: string; state?: string; country?: string } = {
    roadName: 'Acquiring Roadway...',
    city: 'Detecting Location...',
    state: '',
    country: '',
  };

  public getStatus(): GpsStatus {
    return this.currentStatus;
  }

  public subscribeStatus(listener: (status: GpsStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: GpsStatus): void {
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      this.statusListeners.forEach((fn) => fn(status));
    }
  }

  public async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        return true;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      this.setStatus(granted ? 'acquiring' : 'denied');
      return granted;
    } catch {
      this.setStatus('error');
      return false;
    }
  }

  /**
   * Retrieves the real physical GPS position from the hardware device with multi-tier fallback.
   */
  public async getCurrentLocation(): Promise<LocationReading> {
    if (this.isSimulating) {
      return this.getSimulatedReading();
    }

    // 1. Web Geolocation API
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      return new Promise((resolve) => {
        const handleSuccess = (pos: GeolocationPosition) => {
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
            country: this.cachedRoadInfo.country,
          };
          this.lastValidReading = reading;
          this.setStatus('locked');
          this.reverseGeocode(reading.latitude, reading.longitude);
          resolve(reading);
        };

        // First attempt with high accuracy
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          (err) => {
            if (err.code === 1) {
              // Permission denied
              this.setStatus('denied');
              resolve(this.getFallbackReading());
              return;
            }

            // Retry with cellular / network geolocation if GPS timed out
            navigator.geolocation.getCurrentPosition(
              handleSuccess,
              () => {
                this.setStatus('error');
                resolve(this.getFallbackReading());
              },
              { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
            );
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 }
        );
      });
    }

    // 2. Mobile Expo Location API
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== 'granted') {
          this.setStatus('denied');
          return this.getFallbackReading();
        }
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
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
        country: this.cachedRoadInfo.country,
      };

      this.lastValidReading = reading;
      this.setStatus('locked');
      this.reverseGeocode(reading.latitude, reading.longitude);
      return reading;
    } catch {
      this.setStatus('error');
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
      this.setStatus('locked');
      callback(this.getSimulatedReading());
      return;
    }

    this.setStatus('acquiring');

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
            country: this.cachedRoadInfo.country,
          };
          this.lastValidReading = reading;
          this.setStatus('locked');
          this.reverseGeocode(reading.latitude, reading.longitude).then((info) => {
            reading.roadName = info.roadName;
            reading.city = info.city;
            reading.state = info.state;
            reading.country = info.country;
            callback(reading);
          });
          callback(reading);
        },
        (err) => {
          if (err.code === 1) {
            this.setStatus('denied');
          } else {
            this.setStatus('error');
          }
          // If we have a previous fix, send that instead of fake location
          if (this.lastValidReading) {
            callback(this.lastValidReading);
          }
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 2000 }
      );

      // Fetch initial fix immediately
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
          country: this.cachedRoadInfo.country,
        };
        this.lastValidReading = reading;
        this.setStatus('locked');
        this.reverseGeocode(reading.latitude, reading.longitude).then((info) => {
          reading.roadName = info.roadName;
          reading.city = info.city;
          reading.state = info.state;
          reading.country = info.country;
          callback(reading);
        });
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
    if (this.lastValidReading) {
      return this.lastValidReading;
    }
    return {
      latitude: DEFAULT_COORDINATES.latitude,
      longitude: DEFAULT_COORDINATES.longitude,
      accuracy: 25.0,
      speed: 0,
      heading: 0,
      altitude: 0,
      timestamp: new Date().toISOString(),
      isAccuracyLow: true,
      roadName: 'Acquiring GPS...',
      city: 'Locating...',
      state: '',
      country: '',
    };
  }

  private getSimulatedReading(): LocationReading {
    return {
      latitude: 26.4499,
      longitude: 80.3319,
      accuracy: 4.2,
      speed: 32.0,
      heading: 95,
      altitude: 124,
      timestamp: new Date().toISOString(),
      isAccuracyLow: false,
      roadName: 'Grand Trunk Road',
      city: 'Kanpur',
      state: 'Uttar Pradesh',
      country: 'India',
    };
  }

  /**
   * Universal Reverse Geocoder (Native + Web OpenStreetMap Nominatim with local memory cache)
   */
  public async reverseGeocode(latitude: number, longitude: number): Promise<{
    roadName?: string;
    city?: string;
    state?: string;
    country?: string;
  }> {
    const gridKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
    if (this.geocodeCache.has(gridKey)) {
      return this.geocodeCache.get(gridKey)!;
    }

    try {
      if (Platform.OS !== 'web') {
        const places = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (places && places.length > 0) {
          const p = places[0];
          const info = {
            roadName: p.street || p.name || 'Current Roadway',
            city: p.city || p.district || 'Local City',
            state: p.region || '',
            country: p.country || '',
          };
          this.cachedRoadInfo = info;
          this.geocodeCache.set(gridKey, info);
          return info;
        }
      } else {
        // Web: Throttle OSM Nominatim calls to max once every 3.5s
        const now = Date.now();
        if (now - this.lastGeocodeRequestTime > 3500) {
          this.lastGeocodeRequestTime = now;
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
          const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const info = {
              roadName: addr.road || addr.pedestrian || addr.highway || addr.suburb || data.name || 'Current Roadway',
              city: addr.city || addr.town || addr.village || addr.county || 'Local City',
              state: addr.state || '',
              country: addr.country || '',
            };
            this.cachedRoadInfo = info;
            this.geocodeCache.set(gridKey, info);
            return info;
          }
        }
      }
    } catch {
      // Keep cached
    }
    return this.cachedRoadInfo;
  }
}

export const locationService = new LocationService();
