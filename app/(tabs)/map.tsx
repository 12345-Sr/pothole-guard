import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { usePotholeStore } from '../../stores/potholeStore';
import { useLocationStore } from '../../stores/locationStore';
import { MapViewComponent } from '../../components/MapViewComponent';
import { PotholeBottomSheet } from '../../components/PotholeBottomSheet';
import { PotholeSeverity, PotholeStatus } from '../../models/Pothole';
import { Search, Filter, Layers, Navigation } from 'lucide-react-native';

const FILTER_CHIPS: { label: string; value: PotholeStatus | 'all' }[] = [
  { label: 'All Hazards', value: 'all' },
  { label: 'Detected', value: 'detected' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Repaired', value: 'repaired' },
];

export default function LiveMapScreen() {
  const {
    potholes,
    selectedPothole,
    setSelectedPothole,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    getFilteredPotholes,
  } = usePotholeStore();

  const currentLocation = useLocationStore((s) => s.currentLocation);
  const [activeFilter, setActiveFilter] = useState<PotholeStatus | 'all'>('all');

  const filteredPotholes = getFilteredPotholes();

  const handleChipSelect = (status: PotholeStatus | 'all') => {
    setActiveFilter(status);
    setFilterStatus(status);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Search & Filter Bar */}
        <View style={styles.topControlContainer}>
          <View style={styles.searchBar}>
            <Search size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search roads, city, or hazards..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Filter Chips Scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {FILTER_CHIPS.map((chip) => {
              const isSelected = activeFilter === chip.value;
              return (
                <TouchableOpacity
                  key={chip.value}
                  style={[
                    styles.chip,
                    isSelected && styles.chipActive,
                  ]}
                  onPress={() => handleChipSelect(chip.value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.chipTextActive,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Universal Map Canvas */}
        <View style={styles.mapContainer}>
          <MapViewComponent
            userLat={currentLocation.latitude}
            userLon={currentLocation.longitude}
            potholes={filteredPotholes}
            selectedPothole={selectedPothole}
            onSelectPothole={(p) => setSelectedPothole(p)}
          />
        </View>

        {/* Interactive Bottom Sheet Inspector */}
        {selectedPothole && (
          <PotholeBottomSheet
            pothole={selectedPothole}
            userLat={currentLocation.latitude}
            userLon={currentLocation.longitude}
            onClose={() => setSelectedPothole(null)}
          />
        )}
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
    position: 'relative',
  },
  topControlContainer: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    zIndex: 10,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  chipsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(19, 26, 41, 0.92)',
    borderColor: '#334155',
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  chipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#090D16',
  },
  mapContainer: {
    flex: 1,
  },
});
