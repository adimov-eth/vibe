import { colors } from '@/constants/styles';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const ReanimatedView = Reanimated.createAnimatedComponent(View);

interface RecordButtonProps {
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
}

/**
 * Button component for starting and stopping recordings
 * Provides animated feedback and accessibility features
 */
export const RecordButton = React.memo(({ 
  isRecording, 
  onPress, 
  disabled = false 
}: RecordButtonProps) => {
  // Shared values for animations
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(1);

  // Set up animations based on recording state
  useEffect(() => {
    if (isRecording) {
      // Pulsing glow animation when recording
      glowOpacity.value = withRepeat(
        withTiming(0.5, { duration: 1000 }),
        -1, // Infinite repetition
        true  // Reverse each cycle (pulse effect)
      );
      
      glowScale.value = withRepeat(
        withTiming(1.3, { duration: 1000 }),
        -1,
        true
      );
    } else {
      // Reset animations when not recording
      glowOpacity.value = withTiming(0);
      glowScale.value = withTiming(1);
    }
  }, [isRecording, glowOpacity, glowScale]);

  // Animated styles
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.6 : 1
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  // Touch handlers with appropriate disabled checks
  const handlePressIn = useCallback(() => {
    if (!disabled) {
      scale.value = withSpring(0.95);
    }
  }, [disabled, scale]);

  const handlePressOut = useCallback(() => {
    if (!disabled) {
      scale.value = withSpring(1);
    }
  }, [disabled, scale]);

  const handlePress = useCallback(() => {
    if (!disabled) {
      onPress();
    }
  }, [disabled, onPress]);

  return (
    <View style={styles.container}>
      {/* Background glow effect */}
      <ReanimatedView style={[styles.glow, glowStyle]} />
      
      {/* Main button */}
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}
        accessibilityState={{ disabled }}
      >
        <ReanimatedView style={[styles.button, buttonStyle]}>
          <Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={24}
            color="white"
          />
        </ReanimatedView>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  glow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    opacity: 0,
  },
});