import { Platform, Linking } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Pothole } from '../models/Pothole';
import { getSeverityLabel } from './severityService';

const BACKEND_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.1.40:8000';

export function getShareableLink(potholeId: string): string {
  return `${BACKEND_BASE}/pothole/${potholeId}`;
}

export async function sharePothole(pothole: Pothole): Promise<void> {
  const shareLink = getShareableLink(pothole.id);
  const mapLink = `https://maps.google.com/?q=${pothole.latitude},${pothole.longitude}`;
  const severityText = getSeverityLabel(pothole.severity);
  const road = pothole.roadName || 'Roadway Hazard';

  const message = `🚨 PotholeGuard Hazard Alert!\n\n` +
    `Severity: ${severityText}\n` +
    `Road: ${road}\n` +
    `GPS: ${pothole.latitude.toFixed(6)}°, ${pothole.longitude.toFixed(6)}°\n\n` +
    `🔍 Live Report & Real Photo Evidence:\n${shareLink}\n\n` +
    `🗺️ Google Maps Directions:\n${mapLink}`;

  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `PotholeGuard: ${severityText} Hazard`,
          text: message,
          url: shareLink,
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        alert('Live Pothole Inspection Link copied to clipboard!\n\n' + shareLink);
      }
    } else {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        // Native share sheet
        await Linking.openURL(`sms:&body=${encodeURIComponent(message)}`);
      } else {
        await Linking.openURL(shareLink);
      }
    }
  } catch (err) {
    console.warn('Sharing failed', err);
  }
}

export async function copyPotholeLink(pothole: Pothole): Promise<string> {
  const shareLink = getShareableLink(pothole.id);
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(shareLink);
  }
  return shareLink;
}

