import { create } from 'zustand';
import { Pothole, PotholeSeverity, PotholeStatus } from '../models/Pothole';
import { storageService } from '../services/storageService';
import { isDuplicatePothole } from '../services/duplicateService';
import { syncService } from '../services/syncService';
import { calculateDistance } from '../utils/haversine';

export const INITIAL_MOCK_POTHOLES: Pothole[] = [];

interface PotholeState {
  potholes: Pothole[];
  selectedPothole: Pothole | null;
  filterStatus: PotholeStatus | 'all';
  searchQuery: string;
  isLoaded: boolean;
  loadPotholes: () => Promise<void>;
  addPothole: (newPothole: Pothole) => { isDuplicate: boolean; pothole: Pothole };
  confirmPothole: (id: string) => Promise<void>;
  rejectPothole: (id: string) => Promise<void>;
  markRepaired: (id: string) => Promise<void>;
  setSelectedPothole: (pothole: Pothole | null) => void;
  setFilterStatus: (status: PotholeStatus | 'all') => void;
  setSearchQuery: (query: string) => void;
  getFilteredPotholes: () => Pothole[];
  getSortedByDistance: (userLat: number, userLon: number) => Pothole[];
}

const BACKEND_API = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.1.40:8000';

export const usePotholeStore = create<PotholeState>((set, get) => ({
  potholes: [],
  selectedPothole: null,
  filterStatus: 'all',
  searchQuery: '',
  isLoaded: false,

  loadPotholes: async () => {
    try {
      // Fetch live records from backend SQLite database
      const res = await fetch(`${BACKEND_API}/api/potholes`);
      if (res.ok) {
        const livePotholes: Pothole[] = await res.json();
        set({ potholes: livePotholes, isLoaded: true });
        await storageService.savePotholes(livePotholes);
        return;
      }
    } catch {
      // Offline fallback
    }

    const stored = await storageService.getPotholes();
    set({ potholes: stored || [], isLoaded: true });
  },

  addPothole: (candidate: Pothole) => {
    const list = get().potholes;
    // Spatio-temporal duplicate check (<10m and 30s)
    const check = isDuplicatePothole(
      candidate.latitude,
      candidate.longitude,
      candidate.detectionTimestamp,
      list
    );

    if (check.isDuplicate && check.matchingPothole) {
      // Merge: Increment vote count and update timestamp
      const updatedList = list.map((p) => {
        if (p.id === check.matchingPothole!.id) {
          return {
            ...p,
            voteCount: p.voteCount + 1,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      });
      set({ potholes: updatedList });
      storageService.savePotholes(updatedList);
      return { isDuplicate: true, pothole: check.matchingPothole };
    }

    // Fresh detection
    const updatedList = [candidate, ...list];
    set({ potholes: updatedList });
    storageService.savePotholes(updatedList);
    syncService.enqueue(candidate);
    return { isDuplicate: false, pothole: candidate };
  },

  confirmPothole: async (id: string) => {
    const updated = get().potholes.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          status: 'confirmed' as PotholeStatus,
          voteCount: p.voteCount + 1,
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });
    set({
      potholes: updated,
      selectedPothole: get().selectedPothole?.id === id
        ? updated.find((p) => p.id === id) || null
        : get().selectedPothole,
    });
    await storageService.savePotholes(updated);
  },

  rejectPothole: async (id: string) => {
    const updated = get().potholes.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          status: 'rejected' as PotholeStatus,
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });
    set({
      potholes: updated,
      selectedPothole: get().selectedPothole?.id === id
        ? updated.find((p) => p.id === id) || null
        : get().selectedPothole,
    });
    await storageService.savePotholes(updated);
  },

  markRepaired: async (id: string) => {
    const updated = get().potholes.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          status: 'repaired' as PotholeStatus,
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });
    set({
      potholes: updated,
      selectedPothole: get().selectedPothole?.id === id
        ? updated.find((p) => p.id === id) || null
        : get().selectedPothole,
    });
    await storageService.savePotholes(updated);
  },

  setSelectedPothole: (pothole: Pothole | null) => set({ selectedPothole: pothole }),
  setFilterStatus: (filterStatus) => set({ filterStatus }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  getFilteredPotholes: () => {
    const { potholes, filterStatus, searchQuery } = get();
    return potholes.filter((p) => {
      const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        (p.roadName && p.roadName.toLowerCase().includes(q)) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        p.severity.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  },

  getSortedByDistance: (userLat: number, userLon: number) => {
    const filtered = get().getFilteredPotholes();
    return filtered
      .map((p) => ({
        ...p,
        distanceMeters: calculateDistance(userLat, userLon, p.latitude, p.longitude),
      }))
      .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  },
}));
