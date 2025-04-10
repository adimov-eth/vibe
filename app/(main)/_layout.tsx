import { useAuthentication } from "@/hooks/useAuthentication";
import { Redirect, Stack } from "expo-router";
import React from "react";

export default function MainLayout() {
  const { isAuthenticated, isLoading } = useAuthentication();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/authenticate" />;
  }

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