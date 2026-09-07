import { storageService, SyncQueueItem } from './storageService';
import { Pothole } from '../models/Pothole';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.1.40:8000';

class SyncService {
  private isSyncing: boolean = false;
  private syncTimer: any = null;

  public async sendRealtimeCoordinates(pothole: Pothole): Promise<boolean> {
    try {
      console.log(`[DISPATCHING REALTIME GPS] Lat: ${pothole.latitude}, Lon: ${pothole.longitude}`);
      const response = await fetch(`${BACKEND_URL}/api/potholes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: pothole.latitude,
          longitude: pothole.longitude,
          confidence: pothole.confidence,
          severity: pothole.severity,
          description: `Live auto-detection on ${pothole.roadName || 'Roadway'}`,
          imageUrl: pothole.imageUrl,
          roadName: pothole.roadName,
          speed: pothole.speedAtDetection,
          heading: pothole.heading,
          accuracy: pothole.gpsAccuracy,
        }),
      });
      return response.ok;
    } catch (err) {
      console.warn('Realtime coordinate dispatch failed, queued for offline retry', err);
      return false;
    }
  }

  public async enqueue(pothole: Pothole): Promise<void> {
    // Attempt immediate transmission first
    this.sendRealtimeCoordinates(pothole);

    const queue = await storageService.getSyncQueue();
    const item: SyncQueueItem = {
      id: `sync_${pothole.id}`,
      pothole,
      status: 'pending',
      attempts: 0,
    };
    queue.push(item);
    await storageService.saveSyncQueue(queue);

    // Process remainder of queue in background
    this.processQueue();
  }

  public async processQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.isSyncing) return { processed: 0, succeeded: 0, failed: 0 };
    this.isSyncing = true;

    let succeeded = 0;
    let failed = 0;

    try {
      const queue = await storageService.getSyncQueue();
      const pendingItems = queue.filter(
        (item) => item.status === 'pending' || (item.status === 'failed' && item.attempts < 4)
      );

      for (const item of pendingItems) {
        item.status = 'uploading';
        item.attempts += 1;
        item.lastAttempt = new Date().toISOString();

        try {
          // Attempt POST to backend / Supabase
          const response = await fetch(`${BACKEND_URL}/api/potholes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: item.pothole.latitude,
              longitude: item.pothole.longitude,
              confidence: item.pothole.confidence,
              severity: item.pothole.severity,
              description: `Auto-detected on ${item.pothole.roadName || 'Road'}`,
              imageUrl: item.pothole.imageUrl,
              roadName: item.pothole.roadName,
              speed: item.pothole.speedAtDetection,
              heading: item.pothole.heading,
              accuracy: item.pothole.gpsAccuracy,
            }),
          });

          if (response.ok) {
            item.status = 'synced';
            succeeded += 1;
          } else {
            throw new Error(`Server returned ${response.status}`);
          }
        } catch (err: any) {
          item.status = 'failed';
          item.error = err.message || 'Network error';
          failed += 1;
        }
      }

      await storageService.saveSyncQueue(queue);
    } finally {
      this.isSyncing = false;
    }

    return { processed: succeeded + failed, succeeded, failed };
  }

  public startPeriodicSync(intervalMs: number = 15000): void {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => {
      this.processQueue();
    }, intervalMs);
  }

  public stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
}

export const syncService = new SyncService();
