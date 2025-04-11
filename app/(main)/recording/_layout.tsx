import { Stack } from 'expo-router';
import React from 'react';

export default function RecordingLayout() {
  console.warn("[RecordingLayout] Component rendering...");
  return <Stack screenOptions={{ headerShown: false }} />;
}