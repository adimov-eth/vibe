import ErrorDisplay from '@/components/layout/ErrorDisplay';
import { ToastProvider } from "@/components/ui/Toast";
import useStore from '@/state';
import { registerBackgroundUploadTask } from '@/utils/background-upload';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const NavigationLayout = () => {
  const [appIsReady, setAppIsReady] = useState(false);
  const initializeUploads = useStore(state => state.initializeUploads);

  useEffect(() => {
    async function prepare() {
      try {
        // Register background upload task
        await registerBackgroundUploadTask();
        
        // Add any other initialization logic here
        // For example, load fonts, check initial auth state, etc.
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for smoother transition
      } catch (e) {
        console.warn('Error loading app resources:', e);
      } finally {
        setAppIsReady(true);
        SplashScreen.hideAsync();
      }
    }

    console.log("[RootLayout] Component mounted. Initializing uploads and registering background task...");
    // Initialize pending uploads check/retry
    initializeUploads();

    // Ensure the background task itself is registered
    registerBackgroundUploadTask();

    prepare();
  }, [initializeUploads]); // Run once on mount

  if (!appIsReady) {
    return null;
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      >
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="(auth)" 
          options={{ 
            headerShown: false,
            presentation: 'modal'
          }} 
        />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <ErrorDisplay />
    </>
  );
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <View style={{ flex: 1 }}>
        <NavigationLayout />
        <ToastProvider />
      </View>
    </SafeAreaProvider>
  );
}
