/**
 * PotholeJudge
 *
 * Multi-layer computer vision verification engine to determine:
 * 1. Is the camera actually pointed at an authentic outdoor road surface (asphalt / concrete)?
 * 2. Is the candidate anomaly a genuine physical road crater (cavity with sharp fractured rim),
 *    or is it a soft shadow, indoor floor pattern, bike tire, vehicle part, or camera artifact?
 */

export interface RoadSurfaceVerdict {
  isRoad: boolean;
  meanLuminance: number;
  chromaDelta: number;
  textureVariance: number;
  reason: string;
}

export interface PotholeCavityVerdict {
  isPothole: boolean;
  confidence: number;
  rimGradient: number;
  isolationRatio: number;
  reason: string;
  verdictType: 'not_road' | 'shadow_filtered' | 'edge_border_obstacle' | 'shape_invalid' | 'pothole_confirmed';
}

export class PotholeJudge {
  /**
   * Evaluates whether the scanned visual zone represents an authentic road surface.
   * Asphalt and concrete roads are characterized by:
   * - Very low color saturation / chromaticity (achromatic grey tones).
   * - Moderate daytime/night road luminance.
   * - Natural aggregate granular texture (not perfectly smooth like plastic/wall/paper).
   */
  public static verifyRoadSurface(
    data: Uint8ClampedArray,
    width: number,
    scanHeight: number,
    sampleStep: number = 4
  ): RoadSurfaceVerdict {
    let sumLum = 0;
    let sumChroma = 0;
    let sampledCount = 0;

    // First pass: compute mean luminance and color deviation (chroma)
    for (let y = 0; y < scanHeight; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Luminance (ITU-R BT.601)
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        sumLum += lum;

        // Chromatic distance from pure grey: max difference between color channels
        const maxChroma = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));
        sumChroma += maxChroma;
        sampledCount++;
      }
    }

    if (sampledCount === 0) {
      return { isRoad: false, meanLuminance: 0, chromaDelta: 0, textureVariance: 0, reason: 'No frame data' };
    }

    const meanLum = sumLum / sampledCount;
    const avgChroma = sumChroma / sampledCount;

    // Second pass: compute texture standard deviation
    let sumSqDiff = 0;
    for (let y = 0; y < scanHeight; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const idx = (y * width + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const diff = lum - meanLum;
        sumSqDiff += diff * diff;
      }
    }
    const textureVariance = Math.sqrt(sumSqDiff / sampledCount);

    // Rule 1: Chromatic neutrality test
    // Asphalt is achromatic grey (avgChroma < 28).
    // Indoor rooms, wooden floors, carpets, grass, skin, clothes, colorful tiles have high chroma (> 32).
    if (avgChroma > 28) {
      return {
        isRoad: false,
        meanLuminance: meanLum,
        chromaDelta: avgChroma,
        textureVariance,
        reason: `Non-road colored surface detected (chroma delta: ${avgChroma.toFixed(1)} > 28)`,
      };
    }

    // Rule 2: Illumination limits
    // Under 32 is pitch black / covered lens; over 235 is overexposed sky/light source
    if (meanLum < 32 || meanLum > 235) {
      return {
        isRoad: false,
        meanLuminance: meanLum,
        chromaDelta: avgChroma,
        textureVariance,
        reason: `Road lighting out of operational bounds (lum: ${meanLum.toFixed(1)})`,
      };
    }

    // Rule 3: Texture aggregate test
    // Asphalt has aggregate roughness (texture std dev >= 9.5).
    // Completely smooth painted walls, blank paper, smooth white desks have variance < 7.
    if (textureVariance < 9.5) {
      return {
        isRoad: false,
        meanLuminance: meanLum,
        chromaDelta: avgChroma,
        textureVariance,
        reason: `Uniform surface lacks road aggregate texture (var: ${textureVariance.toFixed(1)} < 9.5)`,
      };
    }

    return {
      isRoad: true,
      meanLuminance: meanLum,
      chromaDelta: avgChroma,
      textureVariance,
      reason: 'Valid road surface confirmed',
    };
  }

  /**
   * Tests whether an identified candidate region possesses genuine physical pothole characteristics:
   * 1. Rim Edge Sharpness (Sobel gradient magnitude along candidate perimeter vs soft shadow)
   * 2. Perimeter Enclosure (is it surrounded by road, or does it bleed offscreen like a bike tire or border)
   * 3. Concave Depth Gradient
   * 4. Natural crater aspect ratio and fill density
   */
  public static judgeCandidateCavity(
    data: Uint8ClampedArray,
    width: number,
    scanHeight: number,
    box: { minX: number; maxX: number; minY: number; maxY: number; craterPixelsCount: number },
    meanRoadLum: number,
    craterThreshold: number
  ): PotholeCavityVerdict {
    const { minX, maxX, minY, maxY, craterPixelsCount } = box;
    const clusterW = maxX - minX;
    const clusterH = maxY - minY;

    // 1. Edge Clearance: Must NOT touch the bottom of the frame (bike tire / rider's foot / car hood)
    // and must not touch the top horizon boundary
    const bottomClearance = scanHeight - maxY;
    if (bottomClearance < 14) {
      return {
        isPothole: false,
        confidence: 0,
        rimGradient: 0,
        isolationRatio: 0,
        reason: 'Touches lower frame border (vehicle/bike foreground obstacle)',
        verdictType: 'edge_border_obstacle',
      };
    }

    // Left and right frame margin clearance
    if (minX < 12 || maxX > width - 12) {
      return {
        isPothole: false,
        confidence: 0,
        rimGradient: 0,
        isolationRatio: 0,
        reason: 'Touches side frame boundary (road curb or off-screen shadow)',
        verdictType: 'edge_border_obstacle',
      };
    }

    // 2. Aspect ratio: Natural craters are roughly elliptical (0.55 to 2.45)
    // Long narrow stripes (cracks, cables, shadows of poles) are rejected
    const aspectRatio = clusterW / (clusterH || 1);
    if (aspectRatio < 0.55 || aspectRatio > 2.45) {
      return {
        isPothole: false,
        confidence: 0,
        rimGradient: 0,
        isolationRatio: 0,
        reason: `Invalid shape aspect ratio: ${aspectRatio.toFixed(2)} (natural pothole is 0.55 - 2.45)`,
        verdictType: 'shape_invalid',
      };
    }

    // 3. Convex Fill Density:
    // Ratio of detected crater pixels to bounding box area
    // A hollow outline or diagonal streak has very low fill density (< 28%)
    const boxArea = (clusterW * clusterH) / 16; // scaled by sample step 4
    const fillDensity = craterPixelsCount / (boxArea || 1);
    if (fillDensity < 0.28) {
      return {
        isPothole: false,
        confidence: 0,
        rimGradient: 0,
        isolationRatio: 0,
        reason: `Irregular hollow density: ${(fillDensity * 100).toFixed(0)}%`,
        verdictType: 'shape_invalid',
      };
    }

    // 4. Sobel Edge Gradient along Rim (Fracture vs Soft Penumbra Shadow)
    // A pothole crater has sharp fractured asphalt edges (steep intensity gradient).
    // A shadow has a soft, gradual transition across 10-20 pixels.
    let totalGradient = 0;
    let edgeSamples = 0;

    // Sample along the perimeter of the candidate box
    const getPixelLum = (px: number, py: number): number => {
      const cx = Math.max(0, Math.min(width - 1, px));
      const cy = Math.max(0, Math.min(scanHeight - 1, py));
      const idx = (cy * width + cx) * 4;
      return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    };

    // Horizontal top & bottom edges gradient check
    for (let x = minX; x <= maxX; x += 6) {
      // Top rim: gradient between outside road and inside cavity
      const topOut = getPixelLum(x, minY - 6);
      const topIn = getPixelLum(x, minY + 6);
      totalGradient += Math.abs(topOut - topIn);
      edgeSamples++;

      // Bottom rim
      const botIn = getPixelLum(x, maxY - 6);
      const botOut = getPixelLum(x, maxY + 6);
      totalGradient += Math.abs(botOut - botIn);
      edgeSamples++;
    }

    // Vertical left & right edges gradient check
    for (let y = minY; y <= maxY; y += 6) {
      const leftOut = getPixelLum(minX - 6, y);
      const leftIn = getPixelLum(minX + 6, y);
      totalGradient += Math.abs(leftOut - leftIn);
      edgeSamples++;

      const rightIn = getPixelLum(maxX - 6, y);
      const rightOut = getPixelLum(maxX + 6, y);
      totalGradient += Math.abs(rightOut - rightIn);
      edgeSamples++;
    }

    const avgRimGradient = edgeSamples > 0 ? totalGradient / edgeSamples : 0;

    // Soft Shadow Rejection:
    // Pothole rim fracture gradient must be steep (>= 28.0).
    // Diffuse cast shadows typically have gradient < 22.0.
    if (avgRimGradient < 28.0) {
      return {
        isPothole: false,
        confidence: 0,
        rimGradient: avgRimGradient,
        isolationRatio: 0,
        reason: `Soft transition detected (gradient ${avgRimGradient.toFixed(1)} < 28.0): Likely a shadow`,
        verdictType: 'shadow_filtered',
      };
    }

    // 5. 360-Degree Perimeter Road Asphalt Enclosure Check
    // A genuine pothole is isolated inside the road: the surrounding area MUST be normal road asphalt.
    let perimeterAsphaltCount = 0;
    let perimeterTotalTests = 0;

    const testPerimeterSpot = (px: number, py: number) => {
      if (px >= 0 && px < width && py >= 0 && py < scanHeight) {
        const lum = getPixelLum(px, py);
        perimeterTotalTests++;
        // Asphalt around rim must be noticeably brighter than the cavity threshold
        if (lum >= craterThreshold + 16) {
          perimeterAsphaltCount++;
        }
      }
    };

    const midX = Math.floor((minX + maxX) / 2);
    const midY = Math.floor((minY + maxY) / 2);

    // Test around cardinal directions and diagonal corners
    testPerimeterSpot(midX, minY - 10);
    testPerimeterSpot(minX, minY - 10);
    testPerimeterSpot(maxX, minY - 10);

    testPerimeterSpot(midX, maxY + 10);
    testPerimeterSpot(minX, maxY + 10);
    testPerimeterSpot(maxX, maxY + 10);

    testPerimeterSpot(minX - 10, midY);
    testPerimeterSpot(maxX + 10, midY);

    const isolationRatio = perimeterTotalTests > 0 ? perimeterAsphaltCount / perimeterTotalTests : 0;

    // At least 70% of perimeter test points must be brighter road asphalt
    if (isolationRatio < 0.70) {
      return {
        isPothole: false,
        confidence: 0,
        rimGradient: avgRimGradient,
        isolationRatio,
        reason: `Perimeter bleeds into surrounding darkness (${(isolationRatio * 100).toFixed(0)}% isolated < 70%)`,
        verdictType: 'shadow_filtered',
      };
    }

    // 6. Compute verified pothole confidence
    // Based on gradient sharpness, isolation, and depth contrast
    const depthContrast = (meanRoadLum - craterThreshold) / (meanRoadLum || 1);
    const confidence = Math.min(
      0.97,
      Math.max(
        0.82,
        0.65 +
          Math.min(0.18, (avgRimGradient - 28) / 80) +
          isolationRatio * 0.12 +
          depthContrast * 0.05
      )
    );

    return {
      isPothole: true,
      confidence: Number(confidence.toFixed(2)),
      rimGradient: Number(avgRimGradient.toFixed(1)),
      isolationRatio: Number(isolationRatio.toFixed(2)),
      reason: 'Confirmed asphalt cavity with fractured rim',
      verdictType: 'pothole_confirmed',
    };
  }
}
