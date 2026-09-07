import { PotholeSeverity } from '../models/Pothole';
import { BoundingBox } from '../models/Detection';

interface SeverityFactors {
  confidence: number;
  boundingBox?: BoundingBox;
  speedKmh?: number;
  voteCount?: number;
}

/**
 * Computes pothole severity based on observable dimensions, model confidence,
 * vehicular speed at detection, and community confirmations.
 * (Note: Does not guess physical depth without 3D depth sensors).
 */
export function calculateSeverity(factors: SeverityFactors): PotholeSeverity {
  const { confidence, boundingBox, speedKmh = 30, voteCount = 1 } = factors;

  // Approximate relative screen area of pothole (0 to 1)
  const area = boundingBox ? boundingBox.width * boundingBox.height : 0.05;

  let score = 0;

  // Area contribution (0 to 40)
  if (area > 0.12) score += 40;
  else if (area > 0.06) score += 28;
  else if (area > 0.02) score += 18;
  else score += 10;

  // Confidence contribution (0 to 30)
  if (confidence >= 0.90) score += 30;
  else if (confidence >= 0.80) score += 22;
  else score += 14;

  // Speed factor (0 to 15) - at higher speeds, potholes cause higher hazard
  if (speedKmh > 60) score += 15;
  else if (speedKmh > 35) score += 10;
  else score += 5;

  // Vote confirmations factor (0 to 15)
  if (voteCount >= 10) score += 15;
  else if (voteCount >= 4) score += 10;
  else score += 5;

  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 38) return 'medium';
  return 'low';
}

export function getSeverityColor(severity: PotholeSeverity): string {
  switch (severity) {
    case 'critical':
      return '#EF4444'; // Bright Red
    case 'high':
      return '#F97316'; // Vivid Orange
    case 'medium':
      return '#F59E0B'; // Amber
    case 'low':
      return '#10B981'; // Emerald Green
    default:
      return '#6B7280';
  }
}

export function getSeverityLabel(severity: PotholeSeverity): string {
  switch (severity) {
    case 'critical':
      return 'Critical Hazard';
    case 'high':
      return 'High Severity';
    case 'medium':
      return 'Medium Hazard';
    case 'low':
      return 'Minor Pothole';
    default:
      return 'Detected';
  }
}
