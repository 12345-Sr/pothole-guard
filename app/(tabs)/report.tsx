import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { usePotholeStore } from '../../stores/potholeStore';
import { useLocationStore } from '../../stores/locationStore';
import { PotholeSeverity, Pothole } from '../../models/Pothole';
import { SeverityBadge } from '../../components/SeverityBadge';
import { Camera, MapPin, CheckCircle, AlertTriangle, Image as ImageIcon } from 'lucide-react-native';

const SEVERITIES: PotholeSeverity[] = ['low', 'medium', 'high', 'critical'];

export default function ManualReportScreen() {
  const router = useRouter();
  const addPothole = usePotholeStore((s) => s.addPothole);
  const currentLocation = useLocationStore((s) => s.currentLocation);

  const [severity, setSeverity] = useState<PotholeSeverity>('medium');
  const [description, setDescription] = useState('');
  const [roadName, setRoadName] = useState(currentLocation.roadName || 'Grand Trunk Road');
  const [photoUrl, setPhotoUrl] = useState(
    'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=60'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    setIsSubmitting(true);

    const newPothole: Pothole = {
      id: `manual-pot-${Date.now()}`,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      confidence: 0.98,
      severity,
      status: 'confirmed',
      imageUrl: photoUrl,
      detectionTimestamp: new Date().toISOString(),
      reportedBy: 'Citizen Reporter',
      roadName,
      city: currentLocation.city || 'Kanpur',
      state: currentLocation.state || 'Uttar Pradesh',
      country: 'India',
      speedAtDetection: currentLocation.speed,
      heading: currentLocation.heading,
      gpsAccuracy: currentLocation.accuracy,
      voteCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = addPothole(newPothole);
    setIsSubmitting(false);
    setSubmitted(true);

    setTimeout(() => {
      setSubmitted(false);
      setDescription('');
      router.push('/(tabs)/map');
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.badge}>CIVIC HAZARD REPORT</Text>
          <Text style={styles.title}>Report a Road Hazard</Text>
          <Text style={styles.subtitle}>
            Submit verified road conditions. GPS coordinates are automatically attached to warn approaching drivers.
          </Text>
        </View>

        {submitted ? (
          <View style={styles.successCard}>
            <CheckCircle size={48} color="#10B981" />
            <Text style={styles.successTitle}>Report Submitted!</Text>
            <Text style={styles.successSub}>
              Added to live civic map and queued for road maintenance team.
            </Text>
          </View>
        ) : (
          <View style={styles.form}>
            {/* Auto GPS Location Card */}
            <View style={styles.locationCard}>
              <View style={styles.locationIcon}>
                <MapPin size={20} color="#38BDF8" />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>AUTOMATIC GPS ATTACHMENT</Text>
                <Text style={styles.locationCoords}>
                  {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
                </Text>
                <Text style={styles.locationAccuracy}>
                  Accuracy: ±{Math.round(currentLocation.accuracy)}m • {currentLocation.city || 'Kanpur'}
                </Text>
              </View>
            </View>

            {/* Road / Location Name Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>ROAD / INTERSECTION</Text>
              <TextInput
                style={styles.textInput}
                value={roadName}
                onChangeText={setRoadName}
                placeholder="e.g. Mall Road near Civil Lines"
                placeholderTextColor="#64748B"
              />
            </View>

            {/* Severity Picker */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>HAZARD SEVERITY</Text>
              <View style={styles.severityRow}>
                {SEVERITIES.map((sev) => {
                  const isSelected = severity === sev;
                  return (
                    <TouchableOpacity
                      key={sev}
                      style={[
                        styles.severityCard,
                        isSelected && styles.severityCardActive,
                      ]}
                      onPress={() => setSeverity(sev)}
                    >
                      <SeverityBadge severity={sev} size="sm" showLabel={false} />
                      <Text
                        style={[
                          styles.severityText,
                          isSelected && styles.severityTextActive,
                        ]}
                      >
                        {sev.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Evidence Image Preview */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EVIDENCE PHOTO</Text>
              <View style={styles.photoContainer}>
                <Image source={{ uri: photoUrl }} style={styles.previewImage} />
                <View style={styles.photoOverlay}>
                  <Camera size={20} color="#FFFFFF" />
                  <Text style={styles.photoOverlayText}>Auto-captured Road Frame</Text>
                </View>
              </View>
            </View>

            {/* Description */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>HAZARD DESCRIPTION (OPTIONAL)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="e.g., Deep crater on right lane before traffic light. Avoid at night."
                placeholderTextColor="#64748B"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitBtnText}>
                {isSubmitting ? 'Recording...' : 'SUBMIT REPORT'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
  },
  content: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  header: {
    marginBottom: 20,
  },
  badge: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  form: {
    gap: 16,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131A29',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
    gap: 12,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  locationCoords: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  locationAccuracy: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#131A29',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  severityCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#131A29',
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 6,
  },
  severityCardActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  severityText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  severityTextActive: {
    color: '#38BDF8',
  },
  photoContainer: {
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  photoOverlayText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnText: {
    color: '#090D16',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  successCard: {
    alignItems: 'center',
    backgroundColor: '#131A29',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 20,
    padding: 32,
    marginVertical: 40,
    gap: 12,
  },
  successTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  successSub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
  },
});
