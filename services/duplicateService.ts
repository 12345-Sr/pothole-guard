import { calculateDistance } from '../utils/haversine';
import { Pothole } from '../models/Pothole';
import { BoundingBox } from '../models/Detection';

export const DUPLICATE_RADIUS_METERS = 10;
export const DUPLICATE_TIME_WINDOW_SECONDS = 30;
export const FRAME_CONFIRMATION_COUNT = 3;

/**
 * Checks whether a candidate pothole is a duplicate of any existing pothole
 * based on spatial proximity (<10m) and temporal window (<30s or already known).
 */
export function isDuplicatePothole(
  candidateLat: number,
  candidateLon: number,
  candidateTimestamp: string,
  existingPotholes: Pothole[],
  radiusMeters: number = DUPLICATE_RADIUS_METERS,
  timeWindowSeconds: number = DUPLICATE_TIME_WINDOW_SECONDS
): { isDuplicate: boolean; matchingPothole?: Pothole } {
  const candidateTime = new Date(candidateTimestamp).getTime();

  for (const existing of existingPotholes) {
    const dist = calculateDistance(
      candidateLat,
      candidateLon,
      existing.latitude,
      existing.longitude
    );

    if (dist <= radiusMeters) {
      const existingTime = new Date(existing.detectionTimestamp).getTime();
      const diffSec = Math.abs(candidateTime - existingTime) / 1000;

      // If within 10 meters and within the time window (or if it's an existing confirmed pothole at same spot)
      if (diffSec <= timeWindowSeconds || existing.status === 'confirmed') {
        return { isDuplicate: true, matchingPothole: existing };
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * Calculates Intersection over Union (IoU) between two bounding boxes.
 * Box format: { x, y, width, height }
 */
export function calculateIoU(boxA: BoundingBox, boxB: BoundingBox): number {
  const xA1 = boxA.x;
  const yA1 = boxA.y;
  const xA2 = boxA.x + boxA.width;
  const yA2 = boxA.y + boxA.height;

  const xB1 = boxB.x;
  const yB1 = boxB.y;
  const xB2 = boxB.x + boxB.width;
  const yB2 = boxB.y + boxB.height;

  const interX1 = Math.max(xA1, xB1);
  const interY1 = Math.max(yA1, yB1);
  const interX2 = Math.min(xA2, xB2);
  const interY2 = Math.min(yA2, yB2);

  const interWidth = Math.max(0, interX2 - interX1);
  const interHeight = Math.max(0, interY2 - interY1);
  const interArea = interWidth * interHeight;

  const areaA = boxA.width * boxA.height;
  const areaB = boxB.width * boxB.height;
  const unionArea = areaA + areaB - interArea;

  if (unionArea <= 0) return 0;
  return interArea / unionArea;
}

export interface TrackedCandidate {
  trackId: string;
  consecutiveFrames: number;
  lastBox: BoundingBox;
  lastTimestamp: number;
  bestConfidence: number;
  isConfirmed: boolean;
}

/**
 * FrameTracker tracks pothole detections across camera frames to ensure
 * temporal stability before triggering alerts or recording potholes.
 */
export class FrameTracker {
  private candidates: TrackedCandidate[] = [];
  private requiredFrames: number;
  private iouThreshold: number;
  private maxAgeMs: number;

  constructor(
    requiredFrames: number = FRAME_CONFIRMATION_COUNT,
    iouThreshold: number = 0.25,
    maxAgeMs: number = 1000
  ) {
    this.requiredFrames = requiredFrames;
    this.iouThreshold = iouThreshold;
    this.maxAgeMs = maxAgeMs;
  }

  /**
   * Process a frame's detected bounding box.
   * Returns true if this detection meets the temporal multi-frame confirmation threshold.
   */
  public update(box: BoundingBox, confidence: number, timestamp: number): {
    confirmed: boolean;
    trackId: string;
    consecutiveFrames: number;
  } {
    // Purge stale tracks older than maxAgeMs
    this.candidates = this.candidates.filter(
      (c) => timestamp - c.lastTimestamp < this.maxAgeMs
    );

    // Find best matching existing track
    let bestMatch: TrackedCandidate | null = null;
    let highestIoU = 0;

    for (const cand of this.candidates) {
      const iou = calculateIoU(cand.lastBox, box);
      if (iou > highestIoU && iou >= this.iouThreshold) {
        highestIoU = iou;
        bestMatch = cand;
      }
    }

    if (bestMatch) {
      bestMatch.consecutiveFrames += 1;
      bestMatch.lastBox = box;
      bestMatch.lastTimestamp = timestamp;
      bestMatch.bestConfidence = Math.max(bestMatch.bestConfidence, confidence);

      const isNowConfirmed =
        !bestMatch.isConfirmed &&
        bestMatch.consecutiveFrames >= this.requiredFrames;

      if (isNowConfirmed) {
        bestMatch.isConfirmed = true;
      }

      return {
        confirmed: isNowConfirmed,
        trackId: bestMatch.trackId,
        consecutiveFrames: bestMatch.consecutiveFrames,
      };
    } else {
      // Start new candidate track
      const newTrack: TrackedCandidate = {
        trackId: `track_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        consecutiveFrames: 1,
        lastBox: box,
        lastTimestamp: timestamp,
        bestConfidence: confidence,
        isConfirmed: false,
      };
      this.candidates.push(newTrack);
      return {
        confirmed: false,
        trackId: newTrack.trackId,
        consecutiveFrames: 1,
      };
    }
  }

  public reset(): void {
    this.candidates = [];
  }
}
