import { calculateSeverity } from '../services/severityService';

describe('Severity Calculation Service', () => {
  it('classifies large bounding box with high confidence and high speed as critical', () => {
    const sev = calculateSeverity({
      confidence: 0.94,
      boundingBox: { x: 0.2, y: 0.5, width: 0.4, height: 0.35 }, // Large area > 0.12
      speedKmh: 65,
      voteCount: 12,
    });
    expect(sev).toBe('critical');
  });

  it('classifies small detection at low speed as low/medium', () => {
    const sev = calculateSeverity({
      confidence: 0.72,
      boundingBox: { x: 0.4, y: 0.7, width: 0.1, height: 0.1 }, // Area 0.01
      speedKmh: 20,
      voteCount: 1,
    });
    expect(['low', 'medium']).toContain(sev);
  });
});
