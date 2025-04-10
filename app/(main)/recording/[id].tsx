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
import debounce from 'lodash.debounce';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface Mode {
  id: string;
  title: string;
  description: string;
  color: string;
}

const getModeDetails = (id: string): Mode => {
  const modes: Record<string, Mode> = {
    mediator: { id: 'mediator', title: 'Mediator', description: 'Get balanced insights', color: '#58BD7D' },
    counselor: { id: 'counselor', title: "Who's Right", description: 'Get a clear verdict', color: '#3B71FE' },
    dinner: { id: 'dinner', title: 'Dinner Planner', description: 'Decide what to eat', color: '#4BC9F0' },
    movie: { id: 'movie', title: 'Movie Night', description: 'Find something to watch', color: '#FF6838' },
  };
  return modes[id] || { id, title: 'Recording', description: 'Record your conversation', color: '#3B71FE' };
};

const RecordingScreen = React.memo(() => {
  const { id: modeParam } = useLocalSearchParams();
  const router = useRouter();

  const modeId = typeof modeParam === 'string' ? modeParam : '';
  const [mode, setMode] = useState<Mode>(() => getModeDetails(modeId));

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
    cleanup,
  } = useRecordingFlow({ modeId });

  const serverId = useStore(
    useCallback((state: StoreState) => state.localToServerIds[localId], [localId])
  );

  const debouncedToggleRecording = useMemo(
    () => debounce(handleToggleRecording, 300, { leading: true, trailing: false }),
    [handleToggleRecording]
  );

  const handleBackPress = useCallback(() => {
    if (!isButtonDisabled && !isProcessing && router.canGoBack()) {
       router.back();
    }
  }, [isButtonDisabled, isProcessing, router]);

  useEffect(() => {
    if (hasRecordingFinishedLastStep && serverId) {
      router.replace(`../results/${serverId}`);
    } else if (hasRecordingFinishedLastStep && !serverId) {}
  }, [hasRecordingFinishedLastStep, serverId, localId, router]);

  useEffect(() => {
    setMode(getModeDetails(modeId));
  }, [modeId]);

  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  const displayError = recordingError;
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
        {}
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

        {}
        <View style={styles.controlsContainer}>
          <Text style={styles.modeLabelText}>Recording Mode</Text>
          <Toggle
            options={['Separate', 'Live']}
            selectedIndex={recordMode === 'separate' ? 0 : 1}
            onChange={handleToggleMode}
            disabled={isRecording || isGloballyDisabled}
          />
        </View>

        {}
        {recordMode === 'separate' && !showProcessingIndicator && (
          <View style={styles.partnerContainer}>
            <Text style={styles.partnerText}>Partner {currentPartner}</Text>
            {currentPartner === 2 && (
              <View style={styles.recordedIndicator}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.recordedText}>Partner 1 recorded</Text>
              </View>
            )}
          </View>
        )}

        {}
        <View style={styles.recordingContainer}>
          {showProcessingIndicator ? (
            <View style={styles.processingContainer}>
               <ActivityIndicator size="large" color={colors.primary} />
               <Text style={styles.processingText}>
                  {isProcessing && isRecording ? 'Stopping recording...' :
                   hasRecordingFinishedLastStep && !serverId ? 'Finalizing...' :
                   'Processing...'}
               </Text>
            </View>
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
              {displayError && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{displayError}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {}
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
  content: { flex: 1, padding: spacing.lg },
  modeCardContainer: { marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  controlsContainer: { marginBottom: spacing.lg, alignItems: 'center' },
  modeLabelText: { ...typography.body2, marginBottom: spacing.sm },
  partnerContainer: { alignItems: 'center', marginVertical: spacing.lg },
  partnerText: { ...typography.heading2, marginBottom: spacing.sm },
  recordedIndicator: { flexDirection: 'row', alignItems: 'center' },
  recordedText: { ...typography.body2, color: colors.success, marginLeft: spacing.xs },
  recordingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  recordingInstructions: { ...typography.body2, color: colors.text.secondary, marginTop: spacing.md },
  errorContainer: { backgroundColor: `${colors.error}20`, borderRadius: 8, padding: spacing.md, marginTop: spacing.md },
  errorText: { ...typography.body2, color: colors.error, textAlign: 'center' },
  waveformContainer: { height: 120, marginVertical: spacing.lg },
  processingContainer: { alignItems: 'center' },
  processingText: { ...typography.body2, color: colors.text.secondary, marginTop: spacing.md },
  progressContainer: { width: '80%', marginTop: spacing.md },
  progressBackground: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: colors.primary },
  progressText: { ...typography.caption, textAlign: 'center', marginTop: spacing.xs },
});