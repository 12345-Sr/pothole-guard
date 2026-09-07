import { calculateDistance, formatDistance } from '../utils/haversine';

describe('Haversine Distance Calculations', () => {
  it('should return 0 meters for identical coordinates', () => {
    const dist = calculateDistance(26.4499, 80.3319, 26.4499, 80.3319);
    expect(dist).toBeCloseTo(0, 1);
  });

  it('should accurately calculate small distance around 500m', () => {
    // 0.0045 deg lat is approx 500m
    const dist = calculateDistance(26.4499, 80.3319, 26.4544, 80.3319);
    expect(dist).toBeGreaterThan(450);
    expect(dist).toBeLessThan(550);
  });

  it('formats distances correctly', () => {
    expect(formatDistance(50)).toBe('50 m');
    expect(formatDistance(1250)).toBe('1.3 km');
    expect(formatDistance(0)).toBe('0 m');
  });
});
