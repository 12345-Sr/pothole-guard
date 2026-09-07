import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

class AudioService {
  private isMuted: boolean = false;
  private lastAlertTime: number = 0;
  private minIntervalMs: number = 4000; // Prevent voice overlap

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public async playPotholeAlert(customMessage: string = 'Caution: Pothole detected ahead'): Promise<void> {
    if (this.isMuted) return;

    const now = Date.now();
    if (now - this.lastAlertTime < this.minIntervalMs) {
      return; // throttle voice speech
    }
    this.lastAlertTime = now;

    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(customMessage);
          utterance.rate = 1.05;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
        }
      } else {
        const isSpeaking = await Speech.isSpeakingAsync();
        if (isSpeaking) {
          await Speech.stop();
        }
        Speech.speak(customMessage, {
          language: 'en-US',
          pitch: 1.0,
          rate: 1.0,
        });
      }
    } catch {
      // Graceful fallback if speech synthesis is restricted
    }
  }
}

export const audioService = new AudioService();
