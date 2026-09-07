import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { usePotholeStore } from '../stores/potholeStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useLocationStore } from '../stores/locationStore';
import { syncService } from '../services/syncService';

export default function RootLayout() {
  const loadPotholes = usePotholeStore((s) => s.loadPotholes);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const startTracking = useLocationStore((s) => s.startTracking);
  const isDemoMode = useSettingsStore((s) => s.isDemoMode);

  useEffect(() => {
    loadSettings();
    loadPotholes();
    startTracking(false); // Real device hardware GPS tracking
    syncService.startPeriodicSync(15000);

    return () => {
      syncService.stopPeriodicSync();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#090D16' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="permissions" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="pothole/[id]"
          options={{
            headerShown: true,
            title: 'Pothole Inspection',
            headerStyle: { backgroundColor: '#0F172A' },
            headerTintColor: '#F8FAFC',
          }}
        />
        <Stack.Screen
          name="history"
          options={{
            headerShown: true,
            title: 'Detection History',
            headerStyle: { backgroundColor: '#0F172A' },
            headerTintColor: '#F8FAFC',
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
