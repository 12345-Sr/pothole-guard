import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PotholeSeverity } from '../models/Pothole';
import { getSeverityColor, getSeverityLabel } from '../services/severityService';

interface SeverityBadgeProps {
  severity: PotholeSeverity;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  size = 'md',
  showLabel = true,
}) => {
  const color = getSeverityColor(severity);
  const label = getSeverityLabel(severity);

  const isSm = size === 'sm';
  const isLg = size === 'lg';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${color}20`,
          borderColor: color,
          paddingVertical: isSm ? 2 : isLg ? 6 : 4,
          paddingHorizontal: isSm ? 6 : isLg ? 12 : 8,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Severity: ${label}`}
    >
      <View style={[styles.dot, { backgroundColor: color, width: isSm ? 6 : 8, height: isSm ? 6 : 8 }]} />
      {showLabel && (
        <Text
          style={[
            styles.text,
            {
              color,
              fontSize: isSm ? 10 : isLg ? 13 : 11,
              fontWeight: '700',
            },
          ]}
        >
          {label.toUpperCase()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    borderRadius: 9999,
    marginRight: 6,
  },
  text: {
    letterSpacing: 0.5,
  },
});
