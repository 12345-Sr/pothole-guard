import { Linking, Platform } from 'react-native';

export function openTurnByTurnNavigation(latitude: number, longitude: number, label?: string): void {
  const encodedLabel = encodeURIComponent(label || 'Pothole Hazard');

  if (Platform.OS === 'ios') {
    const appleMapsUrl = `maps:0,0?q=${encodedLabel}@${latitude},${longitude}`;
    Linking.canOpenURL(appleMapsUrl).then((supported) => {
      if (supported) {
        Linking.openURL(appleMapsUrl);
      } else {
        Linking.openURL(`https://maps.apple.com/?daddr=${latitude},${longitude}`);
      }
    });
  } else if (Platform.OS === 'android') {
    const googleNavUrl = `google.navigation:q=${latitude},${longitude}`;
    const geoUrl = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`;
    Linking.canOpenURL(googleNavUrl).then((supported) => {
      if (supported) {
        Linking.openURL(googleNavUrl);
      } else {
        Linking.openURL(geoUrl);
      }
    });
  } else {
    // Web fallback to Google Maps
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`, '_blank');
  }
}
