import { Pothole } from './Pothole';

export interface TripPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  roadName?: string;
  city?: string;
}

export type RoadQualityRating = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'HAZARDOUS';

export interface TripSession {
  id: string;
  startedAt: string;
  endedAt: string;
  startPoint: TripPoint;
  endPoint: TripPoint;
  potholesCount: number;
  potholes: Pothole[];
  distanceKm: number;
  durationSeconds: number;
  averageSpeedKmh: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  roadQuality: RoadQualityRating;
}

