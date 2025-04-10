import { useAuthentication } from "@/hooks/useAuthentication";
import { Redirect, Stack } from "expo-router";
import React from "react";

export default function MainLayout() {
  const { isAuthenticated, isLoading } = useAuthentication();
  
  console.log('[MainLayout] Rendering - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);

  if (isLoading) {
    console.log('[MainLayout] Returning null (isLoading=true)');
    return null;
  }

  if (!isAuthenticated) {
    console.log('[MainLayout] Redirecting to /(auth)/authenticate (isAuthenticated=false)');
    return <Redirect href="/(auth)/authenticate" />;
  }
  
  console.log('[MainLayout] Rendering Stack');

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="home/index" />
      <Stack.Screen name="home/[id]" />
      <Stack.Screen name="profile/index" />
      <Stack.Screen name="recording" />
      <Stack.Screen name="results/[id]" />
      <Stack.Screen name="paywall" />
    </Stack>
  );
}