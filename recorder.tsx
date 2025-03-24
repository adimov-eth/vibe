"use client"

import { RecordButton } from '@/components/recording/RecordButton';
import { WaveVisualization } from '@/components/recording/WaveVisualization';
import { colors, spacing, typography } from "@/constants/styles";
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const ReanimatedView = Reanimated.createAnimatedComponent(View);

export default function VibeCheckCozyMobile() {
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedType, setSelectedType] = useState("mediator");
  const [selectedMode, setSelectedMode] = useState("separate");
  const [wavePoints, setWavePoints] = useState<number[]>([]);

  // Animated values
  const touchX = useSharedValue(0);
  const touchY = useSharedValue(0);
  const orb1Scale = useSharedValue(1);
  const orb2Scale = useSharedValue(1);

  // Generate wave points
  useEffect(() => {
    const generateWavePoints = () => {
      const points = [];
      for (let i = 0; i < 40; i++) {
        const prevPoint = points[i - 1] || 0.5;
        const maxChange = 0.1;
        const newPoint = Math.max(0.2, Math.min(0.8, prevPoint + (Math.random() * maxChange * 2 - maxChange)));
        points.push(newPoint);
      }
      return points;
    };

    setWavePoints(generateWavePoints());

    // Update points periodically when recording
    let waveInterval: NodeJS.Timeout;

    if (isRecording) {
      waveInterval = setInterval(() => {
        setWavePoints((prev) => {
          return prev.map((point) => {
            const maxChange = 0.08;
            return Math.max(0.2, Math.min(0.8, point + (Math.random() * maxChange * 2 - maxChange)));
          });
        });
      }, 100);
    }

    return () => {
      if (waveInterval) clearInterval(waveInterval);
    };
  }, [isRecording]);

  // Animation styles
  const orb1Style = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: orb1Scale.value },
        { translateX: interpolate(touchX.value, [0, 1], [-200, 200]) },
        { translateY: interpolate(touchY.value, [0, 1], [-200, 200]) },
      ],
      opacity: 0.04,
    };
  });

  const orb2Style = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: orb2Scale.value },
        { translateX: interpolate(touchX.value, [0, 1], [200, -200]) },
        { translateY: interpolate(touchY.value, [0, 1], [200, -200]) },
      ],
      opacity: 0.03,
    };
  });

  // Start background animations
  useEffect(() => {
    orb1Scale.value = withRepeat(
      withTiming(1.03, { duration: 12000 }),
      -1,
      true
    );
    orb2Scale.value = withRepeat(
      withTiming(1.05, { duration: 15000 }),
      -1,
      true
    );
  }, []);

  // Toggle recording state
  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      setRecordingDuration(0);
    }
  };

  // Update recording duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Ambient background elements */}
      <View style={styles.backgroundContainer}>
        <ReanimatedView style={[styles.orb1, orb1Style]} />
        <ReanimatedView style={[styles.orb2, orb2Style]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {}}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
          ]}
        >
          <Ionicons name="menu" size={24} color={colors.text.secondary} />
        </Pressable>

        <Pressable
          onPress={() => {}}
          style={({ pressed }) => [
            styles.avatarButton,
            pressed && styles.avatarButtonPressed,
          ]}
        >
          <View style={styles.avatarInner}>
            <Ionicons name="person" size={20} color={colors.text.secondary} />
          </View>
        </Pressable>
      </View>

      {/* Main content */}
      <View style={styles.main}>
        {/* Title section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>VibeCheck</Text>
          <Text style={styles.subtitle}>
            An objective, 3rd party to help you settle whatever needs settling
          </Text>
        </View>

        {/* Select type section */}
        <View style={styles.selectSection}>
          <View style={styles.selectHeader}>
            <Ionicons 
              name="arrow-back" 
              size={20} 
              color={colors.text.secondary} 
              style={styles.selectIcon} 
            />
            <Text style={styles.selectLabel}>Select type</Text>
          </View>

          <Pressable
            onPress={() => setSelectedType('mediator')}
            style={({ pressed }) => [
              styles.typeCard,
              pressed && styles.typeCardPressed,
              selectedType === 'mediator' && styles.typeCardSelected,
            ]}
          >
            <View style={styles.typeIconContainer}>
              <Ionicons name="people" size={24} color="white" />
            </View>
            <View style={styles.typeInfo}>
              <Text style={styles.typeTitle}>Mediator</Text>
              <Text style={styles.typeDescription}>Get balanced insights</Text>
            </View>
            <View style={[
              styles.typeCheck,
              selectedType === 'mediator' && styles.typeCheckSelected,
            ]}>
              <View style={styles.typeCheckInner} />
            </View>
          </Pressable>
        </View>

        {/* Mode section */}
        <View style={styles.modeSection}>
          <View style={styles.modeHeader}>
            <Text style={styles.modeLabel}>Mode</Text>
            <Ionicons 
              name="help-circle" 
              size={16} 
              color={colors.text.secondary} 
            />
          </View>

          <View style={styles.modeButtons}>
            <Pressable
              onPress={() => setSelectedMode('separate')}
              style={({ pressed }) => [
                styles.modeButton,
                pressed && styles.modeButtonPressed,
                selectedMode === 'separate' && styles.modeButtonSelected,
              ]}
            >
              <Text style={[
                styles.modeButtonText,
                selectedMode === 'separate' && styles.modeButtonTextSelected,
              ]}>
                Separate
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedMode('live')}
              style={({ pressed }) => [
                styles.modeButton,
                pressed && styles.modeButtonPressed,
                selectedMode === 'live' && styles.modeButtonSelected,
              ]}
            >
              <Text style={[
                styles.modeButtonText,
                selectedMode === 'live' && styles.modeButtonTextSelected,
              ]}>
                Live
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Wave visualization and recording button */}
        <View style={styles.recordingSection}>
          <WaveVisualization
            isRecording={isRecording}
            points={wavePoints}
          />
          <View style={styles.recordingControls}>
            {isRecording && (
              <View style={styles.timer}>
                <Text style={styles.timerText}>{formatTime(recordingDuration)}</Text>
              </View>
            )}
            <RecordButton
              isRecording={isRecording}
              onPress={toggleRecording}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb1: {
    position: 'absolute',
    width: 800,
    height: 800,
    borderRadius: 400,
    backgroundColor: colors.accent,
  },
  orb2: {
    position: 'absolute',
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: colors.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
  },
  iconButton: {
    padding: spacing.xs,
  },
  iconButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 2,
    backgroundColor: colors.primary,
  },
  avatarButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  avatarInner: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  titleSection: {
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  title: {
    ...typography.heading1,
    marginBottom: spacing.sm,
    color: colors.primary,
  },
  subtitle: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  selectSection: {
    marginBottom: spacing.xl,
  },
  selectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  selectIcon: {
    marginRight: spacing.sm,
  },
  selectLabel: {
    ...typography.label1,
    color: colors.text.secondary,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background.surface,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  typeCardSelected: {
    borderColor: colors.accent,
  },
  typeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: spacing.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  typeInfo: {
    flex: 1,
  },
  typeTitle: {
    ...typography.body1,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  typeDescription: {
    ...typography.label2,
    color: colors.text.secondary,
  },
  typeCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeCheckSelected: {
    borderColor: colors.accent,
  },
  typeCheckInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  modeSection: {
    marginBottom: spacing.xl,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modeLabel: {
    ...typography.label1,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },
  modeButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.surface,
    borderRadius: spacing.md,
    alignItems: 'center',
  },
  modeButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  modeButtonSelected: {
    backgroundColor: colors.accent,
  },
  modeButtonText: {
    ...typography.label1,
    color: colors.text.secondary,
  },
  modeButtonTextSelected: {
    color: colors.text.inverse,
  },
  recordingSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
  },
  recordingControls: {
    alignItems: 'center',
  },
  timer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background.surface,
    borderRadius: spacing.xl,
    marginBottom: spacing.md,
  },
  timerText: {
    ...typography.label1,
    color: colors.accent,
  },
});

