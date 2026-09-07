import { isDuplicatePothole, calculateIoU, FrameTracker } from '../services/duplicateService';
import { Pothole } from '../models/Pothole';

describe('Duplicate Prevention and Tracking', () => {
  const mockPotholes: Pothole[] = [
    {
      id: 'pot-1',
      latitude: 26.449900,
      longitude: 80.331900,
      confidence: 0.9,
      severity: 'high',
      status: 'confirmed',
      detectionTimestamp: new Date(Date.now() - 10000).toISOString(),
      voteCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it('detects duplicate if location is within 10 meters and within time window', () => {
    // 0.00003 deg is ~3.3 meters
    const check = isDuplicatePothole(
      26.449920,
      80.331920,
      new Date().toISOString(),
      mockPotholes,
      10,
      30
    );
    expect(check.isDuplicate).toBe(true);
    expect(check.matchingPothole?.id).toBe('pot-1');
  });

  it('does not treat distant location as duplicate', () => {
    // 0.002 deg is >200 meters
    const check = isDuplicatePothole(
      26.452000,
      80.334000,
      new Date().toISOString(),
      mockPotholes,
      10,
      30
    );
    expect(check.isDuplicate).toBe(false);
  });

  it('calculates IoU correctly for overlapping boxes', () => {
    const boxA = { x: 0.2, y: 0.5, width: 0.3, height: 0.2 };
    const boxB = { x: 0.25, y: 0.55, width: 0.3, height: 0.2 };

    const iou = calculateIoU(boxA, boxB);
    expect(iou).toBeGreaterThan(0.3);
    expect(iou).toBeLessThan(1.0);
  });

  it('requires 3 consecutive frames before temporal confirmation', () => {
    const tracker = new FrameTracker(3, 0.25, 1000);
    const box = { x: 0.3, y: 0.6, width: 0.2, height: 0.1 };
    const now = Date.now();

    // Frame 1
    const res1 = tracker.update(box, 0.85, now);
    expect(res1.confirmed).toBe(false);
    expect(res1.consecutiveFrames).toBe(1);

    // Frame 2
    const res2 = tracker.update(box, 0.86, now + 100);
    expect(res2.confirmed).toBe(false);
    expect(res2.consecutiveFrames).toBe(2);

    // Frame 3 -> Should confirm
    const res3 = tracker.update(box, 0.88, now + 200);
    expect(res3.confirmed).toBe(true);
    expect(res3.consecutiveFrames).toBe(3);
  });
});
