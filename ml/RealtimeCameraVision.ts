import { DetectionResult, BoundingBox } from '../models/Detection';
import { PotholeJudge, RoadSurfaceVerdict, PotholeCavityVerdict } from './PotholeJudge';

export interface VisionDiagnostic {
  isRoadSurface: boolean;
  roadStatusMessage: string;
  anomalyDetected: boolean;
  candidateVerdict: string;
  rimGradient: number;
  lastAnalyzedTimestamp: number;
}

export class RealtimeCameraVision {
  private canvas: any = null;
  private ctx: any = null;
  private lastDiagnostic: VisionDiagnostic = {
    isRoadSurface: false,
    roadStatusMessage: 'Initializing camera vision...',
    anomalyDetected: false,
    candidateVerdict: 'STANDBY',
    rimGradient: 0,
    lastAnalyzedTimestamp: Date.now(),
  };

  constructor() {
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 320;
      this.canvas.height = 240;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }
  }

  public getDiagnostic(): VisionDiagnostic {
    return this.lastDiagnostic;
  }

  /**
   * Analyzes an actual HTML5 video element frame from the live camera stream.
   * Leverages PotholeJudge to:
   * 1. Validate authentic road asphalt surface (rejects rooms, desks, carpets, clothing, sky).
   * 2. Validate cavity rim fracture gradients (rejects diffuse shadows).
   * 3. Validate perimeter isolation (rejects bike tires, handlebars, rider feet).
   */
  public analyzeVideoFrame(videoElement: any): DetectionResult | null {
    if (!videoElement || !this.ctx || videoElement.readyState < 2) {
      return null;
    }

    try {
      const width = 320;
      const height = 240;

      // Draw current video frame to offscreen analysis canvas
      this.ctx.drawImage(videoElement, 0, 0, width, height);

      // 1. Road zone analysis: lower 55% of the frame (where the road ahead is located)
      const startY = Math.floor(height * 0.45);
      const scanHeight = height - startY;

      const imgData = this.ctx.getImageData(0, startY, width, scanHeight);
      const data = imgData.data;

      // 2. Stage 1: Road Surface Verification
      const roadVerdict: RoadSurfaceVerdict = PotholeJudge.verifyRoadSurface(
        data,
        width,
        scanHeight,
        4
      );

      if (!roadVerdict.isRoad) {
        this.lastDiagnostic = {
          isRoadSurface: false,
          roadStatusMessage: roadVerdict.reason,
          anomalyDetected: false,
          candidateVerdict: 'NON_ROAD_SURFACE',
          rimGradient: 0,
          lastAnalyzedTimestamp: Date.now(),
        };
        return null;
      }

      // 3. Stage 2: Candidate Depression Identification
      const sampleStep = 4;
      const depressionDelta = Math.max(34, roadVerdict.textureVariance * 1.8);
      const craterThreshold = roadVerdict.meanLuminance - depressionDelta;

      if (craterThreshold <= 10) {
        this.lastDiagnostic = {
          isRoadSurface: true,
          roadStatusMessage: 'Road dark / night conditions',
          anomalyDetected: false,
          candidateVerdict: 'INSUFFICIENT_CONTRAST',
          rimGradient: 0,
          lastAnalyzedTimestamp: Date.now(),
        };
        return null;
      }

      let craterPixelsCount = 0;
      let minX = width;
      let maxX = 0;
      let minY = scanHeight;
      let maxY = 0;

      // Margin away from lateral edges
      const marginX = Math.floor(width * 0.08);

      for (let y = 0; y < scanHeight; y += sampleStep) {
        for (let x = marginX; x < width - marginX; x += sampleStep) {
          const idx = (y * width + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

          if (lum < craterThreshold) {
            craterPixelsCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      const clusterWidth = maxX - minX;
      const clusterHeight = maxY - minY;

      // Reject tiny noise or oversized global shadows
      if (
        craterPixelsCount < 100 ||
        clusterWidth < 38 ||
        clusterHeight < 22 ||
        clusterWidth > width * 0.62 ||
        clusterHeight > scanHeight * 0.60
      ) {
        this.lastDiagnostic = {
          isRoadSurface: true,
          roadStatusMessage: 'Road Locked (Asphalt verified)',
          anomalyDetected: false,
          candidateVerdict: 'ROAD_CLEAR',
          rimGradient: 0,
          lastAnalyzedTimestamp: Date.now(),
        };
        return null;
      }

      // 4. Stage 3: Pothole Judge Cavity & Rim Analysis
      const cavityVerdict: PotholeCavityVerdict = PotholeJudge.judgeCandidateCavity(
        data,
        width,
        scanHeight,
        { minX, maxX, minY, maxY, craterPixelsCount },
        roadVerdict.meanLuminance,
        craterThreshold
      );

      if (!cavityVerdict.isPothole) {
        this.lastDiagnostic = {
          isRoadSurface: true,
          roadStatusMessage: 'Road Locked',
          anomalyDetected: true,
          candidateVerdict: cavityVerdict.reason,
          rimGradient: cavityVerdict.rimGradient,
          lastAnalyzedTimestamp: Date.now(),
        };
        return null; // Rigorously filtered: NOT A POTHOLE
      }

      // 5. Confirmed candidate meets all criteria
      this.lastDiagnostic = {
        isRoadSurface: true,
        roadStatusMessage: 'Road Locked',
        anomalyDetected: true,
        candidateVerdict: `Confirmed Pothole (Rim: ${cavityVerdict.rimGradient})`,
        rimGradient: cavityVerdict.rimGradient,
        lastAnalyzedTimestamp: Date.now(),
      };

      // Normalized coordinates [0, 1]
      const normX = Math.max(0.04, minX / width);
      const normY = Math.max(0.40, (minY + startY) / height);
      const normW = Math.min(0.85, clusterWidth / width);
      const normH = Math.min(0.55, clusterHeight / height);

      return {
        detected: true,
        confidence: cavityVerdict.confidence,
        boundingBox: {
          x: normX,
          y: normY,
          width: normW,
          height: normH,
        },
        className: 'pothole',
        timestamp: Date.now(),
      };
    } catch {
      return null;
    }
  }
}

export const realtimeCameraVision = new RealtimeCameraVision();
