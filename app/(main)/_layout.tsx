import { useAuthentication } from "@/hooks/useAuthentication";
import { Redirect, Stack } from "expo-router";
import React, { useEffect, useState } from "react";

export default function MainLayout() {
  const { isAuthenticated, isLoading } = useAuthentication();
  const [initialAuthPassed, setInitialAuthPassed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoading && initialAuthPassed === null) {
      setInitialAuthPassed(isAuthenticated);
    }
  }, [isLoading, isAuthenticated, initialAuthPassed]);

  if (initialAuthPassed === null || isLoading) {
    return null;
  }
  
  if (initialAuthPassed === false) {
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