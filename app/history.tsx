import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { usePotholeStore } from '../stores/potholeStore';
import { PotholeStatus } from '../models/Pothole';
import { SeverityBadge } from '../components/SeverityBadge';
import { formatDate } from '../utils/formatters';
import { Search, ChevronRight, Filter, AlertCircle } from 'lucide-react-native';

const STATUS_FILTERS: { label: string; value: PotholeStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Detected', value: 'detected' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Repaired', value: 'repaired' },
  { label: 'Rejected', value: 'rejected' },
];

export default function HistoryScreen() {
  const router = useRouter();
  const potholes = usePotholeStore((s) => s.potholes);
  const [activeFilter, setActiveFilter] = useState<PotholeStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = potholes.filter((p) => {
    const matchesFilter = activeFilter === 'all' || p.status === activeFilter;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (p.roadName && p.roadName.toLowerCase().includes(q)) ||
      (p.city && p.city.toLowerCase().includes(q)) ||
      p.severity.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search detection history..."
            placeholderTextColor="#64748B"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {STATUS_FILTERS.map((f) => {
            const isSelected = activeFilter === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setActiveFilter(f.value)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* List of Pothole History */}
        <ScrollView contentContainerStyle={styles.listContent}>
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <AlertCircle size={36} color="#64748B" />
              <Text style={styles.emptyTitle}>No records found</Text>
              <Text style={styles.emptySub}>
                Try adjusting your search query or filter criteria.
              </Text>
            </View>
          ) : (
            filtered.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() => router.push(`/pothole/${item.id}`)}
              >
                <View style={styles.cardTop}>
                  <SeverityBadge severity={item.severity} size="sm" />
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
                  </View>
                </View>

                <Text style={styles.roadName} numberOfLines={1}>
                  {item.roadName || 'Road Hazard'}
                </Text>

                <View style={styles.cardBottom}>
                  <Text style={styles.metaText}>
                    {formatDate(item.detectionTimestamp)} • {Math.round(item.confidence * 100)}% Conf
                  </Text>
                  <View style={styles.rightInfo}>
                    <Text style={styles.votesText}>👍 {item.voteCount}</Text>
                    <ChevronRight size={16} color="#64748B" />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
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
    padding: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131A29',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
  },
  filterScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#131A29',
    borderColor: '#1E293B',
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#090D16',
  },
  listContent: {
    gap: 10,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#131A29',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '800',
  },
  roadName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    color: '#64748B',
    fontSize: 11,
  },
  rightInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  votesText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
  },
});
