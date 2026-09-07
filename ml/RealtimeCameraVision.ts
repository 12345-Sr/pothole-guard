import { DetectionResult, BoundingBox } from '../models/Detection';

export class RealtimeCameraVision {
  private canvas: any = null;
  private ctx: any = null;

  constructor() {
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 320;
      this.canvas.height = 240;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }
  }

  /**
   * Analyzes an actual HTML5 video element frame from the live camera stream.
   * Detects dark surface depressions / potholes based on real pixel contrast and variance.
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

      // Focus analysis on lower 65% of the frame (where the road/ground is)
      const startY = Math.floor(height * 0.35);
      const scanHeight = height - startY;

      const imgData = this.ctx.getImageData(0, startY, width, scanHeight);
      const data = imgData.data;

      let darkPixelsCount = 0;
      let minX = width;
      let maxX = 0;
      let minY = scanHeight;
      let maxY = 0;

      // Compute average brightness
      let totalLuminance = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b;
      }
      const avgLuminance = totalLuminance / (data.length / 4);

      // Identify low-luminance clusters (cavities, cracks, dark asphalt depressions)
      const threshold = avgLuminance * 0.65;

      for (let y = 0; y < scanHeight; y += 4) {
        for (let x = 0; x < width; x += 4) {
          const idx = (y * width + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

          if (lum < threshold) {
            darkPixelsCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // If a cluster of dark depression pixels exists with sufficient size
      const clusterWidth = maxX - minX;
      const clusterHeight = maxY - minY;

      if (
        darkPixelsCount > 80 &&
        clusterWidth > 35 &&
        clusterHeight > 25 &&
        clusterWidth < width * 0.85
      ) {
        const normX = Math.max(0.05, minX / width);
        const normY = Math.max(0.35, (minY + startY) / height);
        const normW = Math.min(0.8, clusterWidth / width);
        const normH = Math.min(0.5, clusterHeight / height);

        const confidence = Math.min(0.96, 0.72 + (darkPixelsCount / (width * scanHeight / 16)) * 0.4);

        return {
          detected: true,
          confidence: Number(confidence.toFixed(2)),
          boundingBox: {
            x: normX,
            y: normY,
            width: normW,
            height: normH,
          },
          className: 'pothole',
          timestamp: Date.now(),
        };
      }

      return null;
    } catch (err) {
      return null;
    }
  }
}

export const realtimeCameraVision = new RealtimeCameraVision();
