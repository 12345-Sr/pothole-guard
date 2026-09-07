export interface BoundingBox {
  x: number;      // 0 to 1 normalized horizontal center or top-left
  y: number;      // 0 to 1 normalized vertical center or top-left
  width: number;  // 0 to 1 normalized width
  height: number; // 0 to 1 normalized height
}

export interface DetectionResult {
  detected: boolean;
  confidence: number;
  boundingBox: BoundingBox;
  className: 'pothole';
  timestamp: number;
  trackId?: string;
}

export interface FrameMetadata {
  timestamp: number;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
}
