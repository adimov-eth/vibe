import { ModeCard } from '@/components/conversation/ModeCard';
import { AppBar } from '@/components/layout/AppBar';
import { Container } from '@/components/layout/Container';
import { AudioWaveform } from '@/components/recording/AudioWaveform';
import { RecordButton } from '@/components/recording/RecordButton';
import { Toggle } from '@/components/ui/Toggle';
import { colors, spacing, typography } from '@/constants/styles';
import { useRecordingFlow } from '@/hooks';
import useStore from '@/state';
import type { StoreState } from '@/state/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface Mode {
  id: string;
  title: string;
  description: string;
  color: string;
}

// Pre-defined modes configuration
const MODES: Record<string, Mode> = {
  mediator: { 
    id: 'mediator', 
    title: 'Mediator', 
    description: 'Get balanced insights', 
    color: '#58BD7D' 
  },
  counselor: { 
    id: 'counselor', 
    title: "Who's Right", 
    description: 'Get a clear verdict', 
    color: '#3B71FE' 
  },
  dinner: { 
    id: 'dinner', 
    title: 'Dinner Planner', 
    description: 'Decide what to eat', 
    color: '#4BC9F0' 
  },
  movie: { 
    id: 'movie', 
    title: 'Movie Night', 
    description: 'Find something to watch', 
    color: '#FF6838' 
  },
};

// Default mode for fallback
const DEFAULT_MODE: Mode = { 
  id: 'default', 
  title: 'Recording', 
  description: 'Record your conversation', 
  color: '#3B71FE' 
};

/**
 * Get mode details from ID, with fallback to default
 */
const getModeDetails = (id: string): Mode => {
  return MODES[id] || { ...DEFAULT_MODE, id };
};

/**
 * Processing indicator component to reduce nesting in main component
 */
const ProcessingIndicator = React.memo(({ 
  isProcessing, 
  isRecording, 
  hasFinished, 
  hasServerId 
}: {
  isProcessing: boolean;
  isRecording: boolean;
  hasFinished: boolean;
  hasServerId: boolean;
}) => (
  <View style={styles.processingContainer}>
    <ActivityIndicator size="large" color={colors.primary} />
    <Text style={styles.processingText}>
      {isProcessing && isRecording ? 'Stopping recording...' :
       hasFinished && !hasServerId ? 'Finalizing...' :
       'Processing...'}
    </Text>
  </View>
));

/**
 * Partner indication component for separate recording mode
 */
const PartnerIndicator = React.memo(({ 
  currentPartner 
}: {
  currentPartner: 1 | 2;
}) => (
  <View style={styles.partnerContainer}>
    <Text style={styles.partnerText}>Partner {currentPartner}</Text>
    {currentPartner === 2 && (
      <View style={styles.recordedIndicator}>
        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
        <Text style={styles.recordedText}>Partner 1 recorded</Text>
      </View>
    )}
  </View>
));

/**
 * Recording screen component for capturing audio
 */
const RecordingScreen = React.memo(() => {
  const { id: modeParam } = useLocalSearchParams();
  const router = useRouter();

  const modeId = typeof modeParam === 'string' ? modeParam : '';
  const [mode, setMode] = useState<Mode>(() => getModeDetails(modeId));

  // Recording flow hook for all recording functionality
  const {
    localId,
    recordMode,
    currentPartner,
    isRecording,
    isProcessing,
    isButtonDisabled,
    hasRecordingFinishedLastStep,
    handleToggleMode,
    handleToggleRecording,
    error: recordingError,
  } = useRecordingFlow({ modeId });

  // Get server ID from store to check when upload completes
  const serverId = useStore(
    useCallback((state: StoreState) => state.localToServerIds[localId], [localId])
  );

  // Create debounced handler to prevent double taps
  const debouncedToggleRecording = useMemo(
    () => {
      // Simple debounce function with a flag rather than using lodash
      let isHandling = false;
      return () => {
        if (isHandling) return;
        isHandling = true;
        handleToggleRecording().finally(() => {
          // Reset after a reasonable delay
          setTimeout(() => {
            isHandling = false;
          }, 300);
        });
      };
    },
    [handleToggleRecording]
  );

  // Handle back button press
  const handleBackPress = useCallback(() => {
    if (!isButtonDisabled && !isProcessing && router.canGoBack()) {
      router.back();
    }
  }, [isButtonDisabled, isProcessing, router]);

  // Navigate to results when recording is complete
  useEffect(() => {
    if (hasRecordingFinishedLastStep && serverId) {
      router.replace(`../results/${serverId}`);
    }
  }, [hasRecordingFinishedLastStep, serverId, router]);

  // Update mode when modeId changes
  useEffect(() => {
    setMode(getModeDetails(modeId));
  }, [modeId]);

  // UI state calculations
  const showProcessingIndicator = isProcessing || (hasRecordingFinishedLastStep && !serverId);
  const isGloballyDisabled = isButtonDisabled || showProcessingIndicator;

  return (
    <Container withSafeArea>
      <AppBar
        title={mode.title}
        showBackButton
        onBackPress={handleBackPress}
      />
      <View style={styles.content}>
        {/* Mode card */}
        <View style={styles.modeCardContainer}>
          <ModeCard
            id={mode.id}
            mode={mode.id}
            title={mode.title}
            description={mode.description}
            color={mode.color}
            onPress={() => {}}
          />
        </View>

        <View style={styles.divider} />

        {/* Recording mode toggle */}
        <View style={styles.controlsContainer}>
          <Text style={styles.modeLabelText}>Recording Mode</Text>
          <Toggle
            options={['Separate', 'Live']}
            selectedIndex={recordMode === 'separate' ? 0 : 1}
            onChange={handleToggleMode}
            disabled={isRecording || isGloballyDisabled}
          />
        </View>

        {/* Partner indicator (only for separate mode) */}
        {recordMode === 'separate' && !showProcessingIndicator && (
          <PartnerIndicator currentPartner={currentPartner} />
        )}

        {/* Recording controls */}
        <View style={styles.recordingContainer}>
          {showProcessingIndicator ? (
            <ProcessingIndicator 
              isProcessing={isProcessing} 
              isRecording={isRecording}
              hasFinished={hasRecordingFinishedLastStep}
              hasServerId={!!serverId}
            />
          ) : (
            <>
              <RecordButton
                isRecording={isRecording}
                onPress={debouncedToggleRecording}
                disabled={isGloballyDisabled}
              />
              <Text style={styles.recordingInstructions}>
                {isRecording ? 'Recording... Tap to stop' : 'Tap to start recording'}
              </Text>
              {recordingError && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{recordingError}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Waveform visualization */}
        {!showProcessingIndicator && (
          <View style={styles.waveformContainer}>
            <AudioWaveform isActive={isRecording} />
          </View>
        )}
      </View>
    </Container>
  );
});

export default RecordingScreen;

const styles = StyleSheet.create({
  content: { 
    flex: 1, 
    padding: spacing.lg 
  },
  modeCardContainer: { 
    marginBottom: spacing.md 
  },
  divider: { 
    height: 1, 
    backgroundColor: colors.border, 
    marginVertical: spacing.md 
  },
  controlsContainer: { 
    marginBottom: spacing.lg, 
    alignItems: 'center' 
  },
  modeLabelText: { 
    ...typography.body2, 
    marginBottom: spacing.sm 
  },
  partnerContainer: { 
    alignItems: 'center', 
    marginVertical: spacing.lg 
  },
  partnerText: { 
    ...typography.heading2, 
    marginBottom: spacing.sm 
  },
  recordedIndicator: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  recordedText: { 
    ...typography.body2, 
    color: colors.success, 
    marginLeft: spacing.xs 
  },
  recordingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  recordingInstructions: { 
    ...typography.body2, 
    color: colors.text.secondary, 
    marginTop: spacing.md 
  },
  errorContainer: { 
    backgroundColor: `${colors.error}20`, 
    borderRadius: 8, 
    padding: spacing.md, 
    marginTop: spacing.md 
  },
  errorText: { 
    ...typography.body2, 
    color: colors.error, 
    textAlign: 'center' 
  },
  waveformContainer: { 
    height: 120, 
    marginVertical: spacing.lg 
  },
  processingContainer: { 
    alignItems: 'center' 
  },
  processingText: { 
    ...typography.body2, 
    color: colors.text.secondary, 
    marginTop: spacing.md 
  },
});