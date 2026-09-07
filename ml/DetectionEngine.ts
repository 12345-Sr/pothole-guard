import { DetectionResult } from '../models/Detection';

export interface DetectionEngineConfig {
  confidenceThreshold: number;
  inputWidth: number;
  inputHeight: number;
  fpsLimit: number;
}

export const DEFAULT_DETECTION_CONFIG: DetectionEngineConfig = {
  confidenceThreshold: 0.70,
  inputWidth: 640,
  inputHeight: 360,
  fpsLimit: 8,
};

export interface DetectionEngine {
  initialize(config?: Partial<DetectionEngineConfig>): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  processFrame(frameData?: any): Promise<DetectionResult | null>;
  dispose(): Promise<void>;
  setConfig(config: Partial<DetectionEngineConfig>): void;
  getConfig(): DetectionEngineConfig;
}
