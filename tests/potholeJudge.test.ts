import { PotholeJudge } from '../ml/PotholeJudge';

describe('PotholeJudge Computer Vision Verification', () => {
  const width = 320;
  const height = 132; // scanHeight

  // Helper to create synthetic image buffer
  function createSyntheticBuffer(
    fillFn: (x: number, y: number) => { r: number; g: number; b: number }
  ): Uint8ClampedArray {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const color = fillFn(x, y);
        data[idx] = color.r;
        data[idx + 1] = color.g;
        data[idx + 2] = color.b;
        data[idx + 3] = 255;
      }
    }
    return data;
  }

  describe('Road Surface Verification', () => {
    test('rejects indoor colored wooden surface (high chroma delta)', () => {
      // Wood floor / desk: warm red-brown tones (r: 160, g: 90, b: 40)
      const data = createSyntheticBuffer((x, y) => ({
        r: 160 + (x % 5),
        g: 90 + (y % 5),
        b: 40,
      }));

      const verdict = PotholeJudge.verifyRoadSurface(data, width, height);
      expect(verdict.isRoad).toBe(false);
      expect(verdict.reason).toContain('Non-road colored surface');
    });

    test('rejects uniform flat white surface with no road aggregate texture', () => {
      // Smooth white paper / painted wall
      const data = createSyntheticBuffer(() => ({
        r: 210,
        g: 210,
        b: 210,
      }));

      const verdict = PotholeJudge.verifyRoadSurface(data, width, height);
      expect(verdict.isRoad).toBe(false);
      expect(verdict.reason).toContain('Uniform surface lacks road aggregate texture');
    });

    test('accepts authentic asphalt road surface (achromatic grey with aggregate noise)', () => {
      // Asphalt: neutral grey (r ≈ g ≈ b ≈ 110) with granular aggregate variance (std dev ~ 15)
      const data = createSyntheticBuffer((x, y) => {
        const noise = ((x * 19 + y * 23) % 49) - 24;
        const val = Math.max(0, Math.min(255, 110 + noise));
        return { r: val, g: val, b: val };
      });

      const verdict = PotholeJudge.verifyRoadSurface(data, width, height);
      expect(verdict.isRoad).toBe(true);
      expect(verdict.chromaDelta).toBeLessThan(5);
      expect(verdict.textureVariance).toBeGreaterThan(8);
    });
  });

  describe('Cavity & Shadow Discrimination', () => {
    test('rejects soft penumbra shadow due to low rim gradient', () => {
      // Create asphalt background with a gradual, soft shadow in the center
      const data = createSyntheticBuffer((x, y) => {
        const distFromCenter = Math.hypot(x - 160, y - 66);
        // Gradual fade over 40 pixels -> low edge gradient
        const shadowFactor = Math.min(1, Math.max(0.4, distFromCenter / 40));
        const val = Math.round(110 * shadowFactor);
        return { r: val, g: val, b: val };
      });

      const candidateBox = {
        minX: 130,
        maxX: 190,
        minY: 45,
        maxY: 85,
        craterPixelsCount: 180,
      };

      const verdict = PotholeJudge.judgeCandidateCavity(
        data,
        width,
        height,
        candidateBox,
        110,
        65
      );

      expect(verdict.isPothole).toBe(false);
      expect(verdict.verdictType).toBe('shadow_filtered');
    });

    test('rejects obstacle touching bottom frame border (e.g. bike tire / rider foot)', () => {
      const data = createSyntheticBuffer(() => ({ r: 110, g: 110, b: 110 }));

      // Touches bottom edge (maxY = 128, height = 132 -> clearance 4px < 14px)
      const candidateBox = {
        minX: 120,
        maxX: 180,
        minY: 70,
        maxY: 128,
        craterPixelsCount: 220,
      };

      const verdict = PotholeJudge.judgeCandidateCavity(
        data,
        width,
        height,
        candidateBox,
        110,
        65
      );

      expect(verdict.isPothole).toBe(false);
      expect(verdict.verdictType).toBe('edge_border_obstacle');
    });

    test('confirms genuine pothole with sharp fractured rim on asphalt road', () => {
      // Create asphalt road background (lum: 120) with a sharp crater cavity (lum: 40)
      const data = createSyntheticBuffer((x, y) => {
        // Road aggregate noise
        const noise = ((x * 7 + y * 11) % 15) - 7;
        const roadVal = 120 + noise;

        // Crater ellipse inside (120 to 180 x, 40 to 80 y)
        const dx = (x - 150) / 28;
        const dy = (y - 60) / 18;
        const inCrater = dx * dx + dy * dy <= 1.0;

        if (inCrater) {
          return { r: 40, g: 40, b: 40 }; // Deep dark crater
        }
        return { r: roadVal, g: roadVal, b: roadVal }; // Surrounding road
      });

      const candidateBox = {
        minX: 122,
        maxX: 178,
        minY: 42,
        maxY: 78,
        craterPixelsCount: 190,
      };

      const verdict = PotholeJudge.judgeCandidateCavity(
        data,
        width,
        height,
        candidateBox,
        120,
        70
      );

      expect(verdict.isPothole).toBe(true);
      expect(verdict.verdictType).toBe('pothole_confirmed');
      expect(verdict.confidence).toBeGreaterThanOrEqual(0.82);
      expect(verdict.rimGradient).toBeGreaterThan(28);
    });
  });
});
