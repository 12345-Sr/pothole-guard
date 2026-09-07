import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, MapPin, Users, ChevronRight, ArrowRight } from 'lucide-react-native';
import { storageService } from '../services/storageService';

const PAGES = [
  {
    title: 'Detect potholes automatically',
    description:
      'Mount your phone on the dashboard. Our lightweight AI analyzes the road ahead continuously and identifies hazard craters in real-time.',
    icon: Camera,
    color: '#38BDF8',
  },
  {
    title: 'Know where potholes are',
    description:
      'Pinpoint hazardous road patches with precision GPS mapping, live speed tracking, and early proximity audio warnings before you reach them.',
    icon: MapPin,
    color: '#F59E0B',
  },
  {
    title: 'Help make roads safer',
    description:
      'Join thousands of civic drivers. Confirmed reports are shared with city authorities, road departments, and your fellow citizens.',
    icon: Users,
    color: '#10B981',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleFinish = async () => {
    await storageService.setOnboarded(true);
    router.replace('/permissions');
  };

  const handleNext = () => {
    if (currentIndex < PAGES.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const page = PAGES[currentIndex];
  const IconComponent = page.icon;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header Skip */}
        <View style={styles.topBar}>
          <Text style={styles.brandText}>POTHOLEGUARD</Text>
          <TouchableOpacity onPress={handleFinish} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Content Slide */}
        <View style={styles.slideContainer}>
          <View style={[styles.iconBox, { borderColor: page.color, backgroundColor: `${page.color}15` }]}>
            <IconComponent size={64} color={page.color} />
          </View>

          <Text style={styles.title}>{page.title}</Text>
          <Text style={styles.description}>{page.description}</Text>
        </View>

        {/* Dots & Footer */}
        <View style={styles.footer}>
          <View style={styles.dotsRow}>
            {PAGES.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  currentIndex === idx && {
                    backgroundColor: page.color,
                    width: 24,
                  },
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: page.color }]}
            onPress={handleNext}
          >
            <Text style={styles.nextBtnText}>
              {currentIndex === PAGES.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            {currentIndex === PAGES.length - 1 ? (
              <ArrowRight size={18} color="#090D16" />
            ) : (
              <ChevronRight size={18} color="#090D16" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  brandText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  skipText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  slideContainer: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  iconBox: {
    width: 140,
    height: 140,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 16,
  },
  description: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  footer: {
    paddingBottom: 20,
    gap: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  nextBtnText: {
    color: '#090D16',
    fontSize: 16,
    fontWeight: '800',
  },
});
