import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pothole } from '../models/Pothole';

const KEYS = {
  POTHOLES: '@potholeguard_potholes_v1',
  SYNC_QUEUE: '@potholeguard_sync_queue_v1',
  SETTINGS: '@potholeguard_settings_v1',
  SESSIONS: '@potholeguard_sessions_v1',
  ONBOARDING: '@potholeguard_onboarded_v1',
};

export interface SyncQueueItem {
  id: string;
  pothole: Pothole;
  status: 'pending' | 'uploading' | 'synced' | 'failed';
  attempts: number;
  lastAttempt?: string;
  error?: string;
}

export interface UserSettings {
  isDemoMode: boolean;
  confidenceThreshold: number;
  audioAlerts: boolean;
  vibration: boolean;
  maxGpsAccuracy: number;
  units: 'metric' | 'imperial';
}

export const DEFAULT_SETTINGS: UserSettings = {
  isDemoMode: false, // Default to Real Camera AI scan mode
  confidenceThreshold: 0.70,
  audioAlerts: true,
  vibration: true,
  maxGpsAccuracy: 30,
  units: 'metric',
};

class StorageService {
  public async getPotholes(): Promise<Pothole[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.POTHOLES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public async savePotholes(potholes: Pothole[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.POTHOLES, JSON.stringify(potholes));
    } catch (e) {
      console.warn('Failed to persist potholes locally', e);
    }
  }

  public async addPothole(pothole: Pothole): Promise<void> {
    const list = await this.getPotholes();
    // Prepend new pothole
    const updated = [pothole, ...list.filter((p) => p.id !== pothole.id)];
    await this.savePotholes(updated);
  }

  public async updatePothole(updatedPothole: Pothole): Promise<void> {
    const list = await this.getPotholes();
    const updated = list.map((p) => (p.id === updatedPothole.id ? updatedPothole : p));
    await this.savePotholes(updated);
  }

  public async getSyncQueue(): Promise<SyncQueueItem[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.SYNC_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public async saveSyncQueue(queue: SyncQueueItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.SYNC_QUEUE, JSON.stringify(queue));
    } catch (e) {
      console.warn('Failed to save sync queue', e);
    }
  }

  public async getSettings(): Promise<UserSettings> {
    try {
      const data = await AsyncStorage.getItem(KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public async saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    try {
      await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save settings', e);
    }
    return updated;
  }

  public async isOnboarded(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(KEYS.ONBOARDING);
      return val === 'true';
    } catch {
      return false;
    }
  }

  public async setOnboarded(val: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.ONBOARDING, val ? 'true' : 'false');
    } catch (e) {
      console.warn('Failed to set onboarded state', e);
    }
  }
}

export const storageService = new StorageService();
