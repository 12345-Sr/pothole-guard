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
   * Uses robust photometric contrast, road surface statistics, and geometric aspect-ratio
   * filtering to accurately identify isolated road potholes while rejecting indoor shadows,
   * walls, uniform dark floors, and camera noise.
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
      const totalPixels = width * scanHeight;

      // 2. Compute road surface mean luminance and variance
      let sumLuminance = 0;
      const sampleStep = 4; // Sample every 4 pixels for high performance
      let sampledCount = 0;

      for (let y = 0; y < scanHeight; y += sampleStep) {
        for (let x = 0; x < width; x += sampleStep) {
          const idx = (y * width + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          sumLuminance += lum;
          sampledCount++;
        }
      }

      const meanLuminance = sumLuminance / (sampledCount || 1);

      // Ambient light check: Ignore extremely dark conditions (< 35) or washed out frames (> 240)
      if (meanLuminance < 35 || meanLuminance > 240) {
        return null;
      }

      // Compute standard deviation of road surface
      let sumSquaredDiff = 0;
      for (let y = 0; y < scanHeight; y += sampleStep) {
        for (let x = 0; x < width; x += sampleStep) {
          const idx = (y * width + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          const diff = lum - meanLuminance;
          sumSquaredDiff += diff * diff;
        }
      }
      const stdDev = Math.sqrt(sumSquaredDiff / (sampledCount || 1));

      // Uniform surface rejection: If scene has very low texture variance (e.g. wall, plain floor, lens covered)
      if (stdDev < 14) {
        return null;
      }

      // 3. Local depression threshold:
      // A pothole crater on asphalt is significantly darker than the surrounding road surface.
      // Must be at least 32 luminance units darker and 1.7x the road standard deviation.
      const depressionDelta = Math.max(32, stdDev * 1.7);
      const craterThreshold = meanLuminance - depressionDelta;

      if (craterThreshold <= 10) {
        return null; // Road is already too dark for a distinguishable pothole
      }

      // Identify candidate crater pixels
      let craterPixelsCount = 0;
      let minX = width;
      let maxX = 0;
      let minY = scanHeight;
      let maxY = 0;
      let craterLumSum = 0;

      // We stay slightly away from the extreme left/right edges (road borders/handlebar zone)
      const marginX = Math.floor(width * 0.08);

      for (let y = 0; y < scanHeight; y += sampleStep) {
        for (let x = marginX; x < width - marginX; x += sampleStep) {
          const idx = (y * width + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

          if (lum < craterThreshold) {
            craterPixelsCount++;
            craterLumSum += lum;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      const clusterWidth = maxX - minX;
      const clusterHeight = maxY - minY;

      // 4. Cluster size constraints:
      // Minimum size: ~40px wide, ~25px high (not tiny pebble noise)
      // Maximum size: 60% of road width, 65% of road height (not a huge shadow cast across the whole road)
      if (
        craterPixelsCount < 110 ||
        clusterWidth < 40 ||
        clusterHeight < 24 ||
        clusterWidth > width * 0.62 ||
        clusterHeight > scanHeight * 0.65
      ) {
        return null;
      }

      // 5. Aspect ratio check:
      // Potholes are natural craters/depressions with width/height ratio between 0.55 and 2.6
      const aspectRatio = clusterWidth / clusterHeight;
      if (aspectRatio < 0.55 || aspectRatio > 2.6) {
        return null;
      }

      // 6. Perimeter Isolation Verification:
      // An authentic pothole is surrounded by normal, brighter road surface.
      // If the perimeter is also dark, it is part of a large continuous shadow or dark object.
      let perimeterBrightPoints = 0;
      let perimeterTotalPoints = 0;

      const testPerimeterPoint = (px: number, py: number) => {
        if (px >= 0 && px < width && py >= 0 && py < scanHeight) {
          const idx = (py * width + px) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          perimeterTotalPoints++;
          if (lum >= craterThreshold + 15) {
            perimeterBrightPoints++;
          }
        }
      };

      const centerX = Math.floor((minX + maxX) / 2);
      const centerY = Math.floor((minY + maxY) / 2);
      const padX = 14;
      const padY = 10;

      // Top boundary points
      testPerimeterPoint(centerX, Math.max(0, minY - padY));
      testPerimeterPoint(minX, Math.max(0, minY - padY));
      testPerimeterPoint(maxX, Math.max(0, minY - padY));

      // Bottom boundary points
      testPerimeterPoint(centerX, Math.min(scanHeight - 1, maxY + padY));
      testPerimeterPoint(minX, Math.min(scanHeight - 1, maxY + padY));
      testPerimeterPoint(maxX, Math.min(scanHeight - 1, maxY + padY));

      // Left & right points
      testPerimeterPoint(Math.max(0, minX - padX), centerY);
      testPerimeterPoint(Math.min(width - 1, maxX + padX), centerY);

      // Require at least 65% of perimeter test points to be clear road
      const perimeterIsolationRatio = perimeterTotalPoints > 0 ? perimeterBrightPoints / perimeterTotalPoints : 0;
      if (perimeterIsolationRatio < 0.65) {
        return null; // Surrounded by darkness -> false positive shadow
      }

      // 7. Calculate confidence score based on depth contrast and perimeter isolation
      const avgCraterLum = craterLumSum / (craterPixelsCount || 1);
      const contrastRatio = (meanLuminance - avgCraterLum) / (meanLuminance || 1);
      const confidence = Math.min(
        0.96,
        Math.max(0.72, 0.65 + contrastRatio * 0.35 + perimeterIsolationRatio * 0.15)
      );

      if (confidence < 0.74) {
        return null;
      }

      // Normalize bounding box coordinates [0, 1]
      const normX = Math.max(0.04, minX / width);
      const normY = Math.max(0.40, (minY + startY) / height);
      const normW = Math.min(0.85, clusterWidth / width);
      const normH = Math.min(0.55, clusterHeight / height);

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
    } catch (err) {
      return null;
    }
  }
}

export const realtimeCameraVision = new RealtimeCameraVision();
