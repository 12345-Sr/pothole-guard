import { create } from 'zustand';
import { storageService, UserSettings, DEFAULT_SETTINGS } from '../services/storageService';
import { audioService } from '../services/audioService';

interface SettingsState extends UserSettings {
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  toggleDemoMode: () => Promise<void>;
  toggleAudio: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  isLoaded: false,

  loadSettings: async () => {
    const settings = await storageService.getSettings();
    audioService.setMuted(!settings.audioAlerts);
    set({ ...settings, isLoaded: true });
  },

  updateSettings: async (newSettings: Partial<UserSettings>) => {
    const updated = await storageService.saveSettings(newSettings);
    if (newSettings.audioAlerts !== undefined) {
      audioService.setMuted(!newSettings.audioAlerts);
    }
    set({ ...updated });
  },

  toggleDemoMode: async () => {
    const current = get().isDemoMode;
    await get().updateSettings({ isDemoMode: !current });
  },

  toggleAudio: async () => {
    const current = get().audioAlerts;
    await get().updateSettings({ audioAlerts: !current });
  },
}));
