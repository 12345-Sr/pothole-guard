import { DetectionEngine } from '../ml/DetectionEngine';
import { MockDetectionEngine } from '../ml/MockDetectionEngine';
import { FrameTracker } from './duplicateService';
import { calculateSeverity } from './severityService';
import { audioService } from './audioService';
import { cameraService } from './cameraService';
import { Pothole } from '../models/Pothole';
import { DetectionResult } from '../models/Detection';
import { LocationReading } from './locationService';

export type DetectionEventListener = (event: {
  type: 'frame_detection' | 'confirmed_pothole';
  detection?: DetectionResult;
  pothole?: Pothole;
}) => void;

class DetectionService {
  private engine: DetectionEngine;
  private frameTracker: FrameTracker;
  private isScanning: boolean = false;
  private listeners: Set<DetectionEventListener> = new Set();
  private scanInterval: any = null;

  constructor() {
    this.engine = new MockDetectionEngine();
    this.frameTracker = new FrameTracker(3, 0.25, 1200);
  }

  public setEngine(engine: DetectionEngine): void {
    this.engine = engine;
  }

  public subscribe(listener: DetectionEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(event: Parameters<DetectionEventListener>[0]): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Detection listener error', err);
      }
    });
  }

  public async startScan(getCurrentLocation: () => LocationReading): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;
    this.frameTracker.reset();
    await this.engine.start();

    // Loop running frame evaluation at ~8 FPS (125ms intervals)
    this.scanInterval = setInterval(async () => {
      if (!this.isScanning) return;

      try {
        const detection = await this.engine.processFrame();

        if (detection && detection.detected) {
          this.notify({ type: 'frame_detection', detection });

          // Multi-frame IoU stability check
          const tracking = this.frameTracker.update(
            detection.boundingBox,
            detection.confidence,
            detection.timestamp
          );

          if (tracking.confirmed) {
            const loc = getCurrentLocation();
            const severity = calculateSeverity({
              confidence: detection.confidence,
              boundingBox: detection.boundingBox,
              speedKmh: loc.speed,
              voteCount: 1,
            });

            // Automatically take screenshot of the road ahead with the detected pothole
            const snapshotUri = await cameraService.captureEvidenceSnapshot({
              latitude: loc.latitude,
              longitude: loc.longitude,
              timestamp: new Date(detection.timestamp).toISOString(),
              speed: loc.speed,
            });

            const newPothole: Pothole = {
              id: `pot-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              latitude: loc.latitude,
              longitude: loc.longitude,
              confidence: detection.confidence,
              severity,
              status: 'detected',
              imageUrl: snapshotUri,
              detectionTimestamp: new Date(detection.timestamp).toISOString(),
              reportedBy: 'Bike Ride Scanner',
              roadName: loc.roadName || 'Main Corridor',
              city: loc.city || 'Kanpur',
              state: loc.state || 'Uttar Pradesh',
              country: loc.country || 'India',
              speedAtDetection: loc.speed,
              heading: loc.heading,
              gpsAccuracy: loc.accuracy,
              voteCount: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            // Non-blocking voice alert for bike rider
            audioService.playPotholeAlert('Pothole detected. Screenshot and GPS coordinates saved.');

            this.notify({
              type: 'confirmed_pothole',
              detection,
              pothole: newPothole,
            });
          }
        }
      } catch (err) {
        console.warn('Frame scan error', err);
      }
    }, 125);
  }

  public async stopScan(): Promise<void> {
    this.isScanning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    await this.engine.stop();
    this.frameTracker.reset();
  }

  public getIsScanning(): boolean {
    return this.isScanning;
  }
}

export const detectionService = new DetectionService();
