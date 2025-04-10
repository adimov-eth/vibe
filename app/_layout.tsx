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

SplashScreen.preventAutoHideAsync();

const NavigationLayout = () => {
  const [appIsReady, setAppIsReady] = useState(false);
  const initializeUploads = useStore(state => state.initializeUploads);
  const initializeAppState = useStore(state => state.initializeAppState);

  useEffect(() => {
    async function prepare() {
      try {
        await registerBackgroundUploadTask();
        await initializeAppState();
        await initializeUploads();
      } catch (e) {} finally {
        setAppIsReady(true);
        SplashScreen.hideAsync();
      }
    }

    prepare();
  }, [initializeAppState, initializeUploads]);

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
