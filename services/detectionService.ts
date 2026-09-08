import { DetectionEngine } from '../ml/DetectionEngine';
import { MockDetectionEngine } from '../ml/MockDetectionEngine';
import { realtimeCameraVision, VisionDiagnostic } from '../ml/RealtimeCameraVision';
import { FrameTracker } from './duplicateService';
import { calculateSeverity } from './severityService';
import { audioService } from './audioService';
import { cameraService } from './cameraService';
import { Pothole } from '../models/Pothole';
import { DetectionResult } from '../models/Detection';
import { LocationReading } from './locationService';

export type ScanMode = 'real' | 'demo';

export type DetectionEventListener = (event: {
  type: 'frame_detection' | 'confirmed_pothole' | 'diagnostic_update';
  detection?: DetectionResult;
  pothole?: Pothole;
  diagnostic?: VisionDiagnostic;
}) => void;

class DetectionService {
  private mockEngine: DetectionEngine;
  private frameTracker: FrameTracker;
  private isScanning: boolean = false;
  private scanMode: ScanMode = 'real';
  private listeners: Set<DetectionEventListener> = new Set();
  private scanInterval: any = null;
  private lastAlertTimestamp: number = 0;
  private readonly ALERT_COOLDOWN_MS = 7000; // Minimum 7 seconds between alerts

  constructor() {
    this.mockEngine = new MockDetectionEngine();
    // 4 consecutive stable frames required (approx ~720ms sustained tracking with IoU >= 0.30)
    this.frameTracker = new FrameTracker(4, 0.30, 1400);
  }

  public setScanMode(mode: ScanMode): void {
    this.scanMode = mode;
    this.frameTracker.reset();
  }

  public getScanMode(): ScanMode {
    return this.scanMode;
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
    this.lastAlertTimestamp = 0;

    if (this.scanMode === 'demo') {
      await this.mockEngine.start();
    }

    // Frame evaluation interval (~5.5 FPS / 180ms)
    this.scanInterval = setInterval(async () => {
      if (!this.isScanning) return;

      try {
        let detection: DetectionResult | null = null;

        if (this.scanMode === 'real') {
          // Real Camera AI Mode: Inspect actual camera video element
          const videoEl = cameraService.getVideoElement();
          if (videoEl && videoEl.readyState >= 2) {
            detection = realtimeCameraVision.analyzeVideoFrame(videoEl);
            const diag = realtimeCameraVision.getDiagnostic();
            this.notify({ type: 'diagnostic_update', diagnostic: diag });
          }
        } else {
          // Demo Simulation Mode
          detection = await this.mockEngine.processFrame();
        }

        if (detection && detection.detected) {
          this.notify({ type: 'frame_detection', detection });

          // Multi-frame IoU stability check (requires 4 consecutive matching frames)
          const tracking = this.frameTracker.update(
            detection.boundingBox,
            detection.confidence,
            detection.timestamp
          );

          // Pothole confirmation gate: requires multi-frame tracking + high confidence
          if (tracking.confirmed && detection.confidence >= 0.80) {
            const now = Date.now();
            // Enforce alert cooldown to prevent sound and screenshot spamming
            if (now - this.lastAlertTimestamp < this.ALERT_COOLDOWN_MS) {
              return;
            }
            this.lastAlertTimestamp = now;

            const loc = getCurrentLocation();
            const severity = calculateSeverity({
              confidence: detection.confidence,
              boundingBox: detection.boundingBox,
              speedKmh: loc.speed,
              voteCount: 1,
            });

            // Automatically capture evidence screenshot ONLY for confirmed potholes
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
              reportedBy: this.scanMode === 'real' ? 'Realtime Camera AI' : 'Simulation Engine',
              roadName: loc.roadName || 'Current Roadway',
              city: loc.city || 'Local Area',
              state: loc.state || '',
              country: loc.country || 'India',
              speedAtDetection: loc.speed,
              heading: loc.heading,
              gpsAccuracy: loc.accuracy,
              voteCount: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            // Calm, non-blocking audio alert
            audioService.playPotholeAlert('Caution: Pothole detected ahead.');

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
    }, 180);
  }

  public async stopScan(): Promise<void> {
    this.isScanning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    if (this.scanMode === 'demo') {
      await this.mockEngine.stop();
    }
    this.frameTracker.reset();
  }

  public getIsScanning(): boolean {
    return this.isScanning;
  }
}

export const detectionService = new DetectionService();
