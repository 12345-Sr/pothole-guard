import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';

interface SafetyBannerProps {
  compact?: boolean;
}

export const SafetyBanner: React.FC<SafetyBannerProps> = ({ compact = false }) => {
  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <ShieldAlert size={compact ? 18 : 22} color="#F59E0B" style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={styles.title}>SAFE DRIVING MODE ACTIVE</Text>
        <Text style={styles.description}>
          Mount device securely. Do not interact with phone while driving. Potholes are recorded hands-free.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1B18',
    borderColor: '#78350F',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
  compactContainer: {
    padding: 8,
    marginVertical: 4,
  },
  icon: {
    marginRight: 10,
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  description: {
    color: '#D1D5DB',
    fontSize: 11,
    lineHeight: 15,
  },
});
