import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Stack } from "expo-router";
import React from "react";

export default function MainLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  // Show nothing while loading
  if (!isLoaded) return null;

  // If user is not signed in, redirect to sign-in page
  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
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
      <Stack.Screen name="profile/update-password" />
      <Stack.Screen name="recording" />
      <Stack.Screen name="results/[id]" />
      <Stack.Screen name="paywall" />
    </Stack>
  );
}