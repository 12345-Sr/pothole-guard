import { DetectionEngine, DetectionEngineConfig, DEFAULT_DETECTION_CONFIG } from './DetectionEngine';
import { DetectionResult } from '../models/Detection';

export class MockDetectionEngine implements DetectionEngine {
  private config: DetectionEngineConfig = { ...DEFAULT_DETECTION_CONFIG };
  private isRunning: boolean = false;
  private frameCounter: number = 0;
  private activeSimulationTrack: {
    active: boolean;
    remainingFrames: number;
    box: { x: number; y: number; width: number; height: number };
    baseConfidence: number;
  } = {
    active: false,
    remainingFrames: 0,
    box: { x: 0.35, y: 0.65, width: 0.28, height: 0.16 },
    baseConfidence: 0.88,
  };

  public async initialize(config?: Partial<DetectionEngineConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    this.frameCounter = 0;
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    this.activeSimulationTrack.active = false;
  }

  public async processFrame(_frameData?: any): Promise<DetectionResult | null> {
    if (!this.isRunning) return null;

    this.frameCounter += 1;

    // Simulate realistic pothole appearance every 12 to 18 frames
    if (!this.activeSimulationTrack.active && this.frameCounter % 15 === 0) {
      this.activeSimulationTrack = {
        active: true,
        remainingFrames: 5, // Lasts for 5 consecutive frames (enough for 3-frame temporal confirmation)
        box: {
          x: 0.25 + Math.random() * 0.35, // Centered/right of road
          y: 0.60 + Math.random() * 0.15, // Road surface zone
          width: 0.22 + Math.random() * 0.12,
          height: 0.12 + Math.random() * 0.08,
        },
        baseConfidence: 0.82 + Math.random() * 0.14,
      };
    }

    if (this.activeSimulationTrack.active && this.activeSimulationTrack.remainingFrames > 0) {
      this.activeSimulationTrack.remainingFrames -= 1;

      // Small jitter between frames for realism
      const currentBox = {
        x: Math.max(0.1, Math.min(0.7, this.activeSimulationTrack.box.x + (Math.random() - 0.5) * 0.015)),
        y: Math.max(0.5, Math.min(0.85, this.activeSimulationTrack.box.y + (Math.random() - 0.5) * 0.01)),
        width: this.activeSimulationTrack.box.width,
        height: this.activeSimulationTrack.box.height,
      };

      const confidence = Math.min(
        0.98,
        this.activeSimulationTrack.baseConfidence + (Math.random() - 0.5) * 0.04
      );

      if (this.activeSimulationTrack.remainingFrames <= 0) {
        this.activeSimulationTrack.active = false;
      }

      if (confidence >= this.config.confidenceThreshold) {
        return {
          detected: true,
          confidence: Number(confidence.toFixed(2)),
          boundingBox: currentBox,
          className: 'pothole',
          timestamp: Date.now(),
        };
      }
    }

    return null;
  }

  public async dispose(): Promise<void> {
    await this.stop();
  }

  public setConfig(config: Partial<DetectionEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): DetectionEngineConfig {
    return { ...this.config };
  }
}
