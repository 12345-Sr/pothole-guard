export type PotholeSeverity = 'low' | 'medium' | 'high' | 'critical';

export type PotholeStatus = 'detected' | 'confirmed' | 'repaired' | 'rejected';

export interface Pothole {
  id: string;
  latitude: number;
  longitude: number;
  confidence: number;
  severity: PotholeSeverity;
  status: PotholeStatus;
  imageUrl?: string;
  detectionTimestamp: string;
  reportedBy?: string;
  roadName?: string;
  city?: string;
  state?: string;
  country?: string;
  speedAtDetection?: number;
  heading?: number;
  gpsAccuracy?: number;
  voteCount: number;
  createdAt: string;
  updatedAt: string;
  distanceMeters?: number;
}

export interface PotholeReportInput {
  latitude: number;
  longitude: number;
  confidence: number;
  severity: PotholeSeverity;
  description?: string;
  imageUrl?: string;
  roadName?: string;
  speed?: number;
  heading?: number;
  gpsAccuracy?: number;
}
