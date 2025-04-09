// /app/(main)/recording/[id].tsx
import { ModeCard } from '@/components/conversation/ModeCard';
import { AppBar } from '@/components/layout/AppBar';
import { Container } from '@/components/layout/Container';
import { AudioWaveform } from '@/components/recording/AudioWaveform';
import { RecordButton } from '@/components/recording/RecordButton';
import { Toggle } from '@/components/ui/Toggle';
import { colors, spacing, typography } from '@/constants/styles';
import { useRecordingFlow } from '@/hooks';
import useStore from '@/state'; // Import useStore
// Import PendingUpload type
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface Mode {
  id: string;
  title: string;
  description: string;
  color: string;
}

export default function Recording() {
  console.log("[RecordingScreen] Component rendering...");
  const { id: modeParam } = useLocalSearchParams(); // Rename to avoid clash
  const router = useRouter();
  const store = useStore();

  // Local UI state
  const modeId = typeof modeParam === 'string' ? modeParam : '';
  const [mode, setMode] = useState<Mode>(() => getModeDetails(modeId));
  // const [isWaitingForUpload, setIsWaitingForUpload] = useState(false); // <-- REMOVED

  // Recording flow hook
  const {
    localId,
    recordMode,
    currentPartner,
    isRecording,
    isProcessing,
    isButtonDisabled,
    handleToggleMode,
    handleToggleRecording,
    error: recordingError,
    cleanup,
  } = useRecordingFlow({ modeId });

  // Get serverId mapping - needed for navigation target
  const serverId = useStore(useCallback(state => state.localToServerIds[localId], [localId]));
  // const uploadResults = useStore(state => state.uploadResults); // <-- REMOVED (monitoring moves to Results screen)

  // Effect to navigate when processing is done (after last step) AND serverId is known
  useEffect(() => {
    // Determine if it *was* the last recording step that finished
    const wasLastStep = recordMode === 'live' || (recordMode === 'separate' && currentPartner === 1); // Partner is 1 *after* P2 finishes
    
    // Navigate only if processing finished, serverId exists, and it was the last step
    if (!isProcessing && serverId && wasLastStep) {
      console.log(`[RecordingScreen] Processing finished, serverId ${serverId} known. Navigating to results...`);
      // Replace ensures user can't navigate back to the recording screen after completion
      router.replace(`../results/${serverId}`);
    } else if (isProcessing && serverId && wasLastStep) {
        console.log(`[RecordingScreen] Last step recorded, processing/uploading. Waiting for completion. ServerID: ${serverId}`);
        // Stay on this screen, show processing indicator. Navigation will occur once isProcessing becomes false.
    }
  }, [isProcessing, serverId, recordMode, currentPartner, localId, router]);

  // Removed the upload monitoring useEffect


  // Load mode details
  useEffect(() => {
    setMode(getModeDetails(modeId));
  }, [modeId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("[RecordingScreen] Component unmounting. Running cleanup.");
      // Cleanup might still involve canceling uploads if the hook manages that,
      // but primarily handles recorder state and local temp files.
      void cleanup();
    };
  }, [cleanup]);

  // Determine overall error state
  const displayError = recordingError;

  // Show processing indicator if the hook reports processing
  const showProcessingIndicator = isProcessing;

  // Button is disabled if hook reports disabled OR if actively processing
  const isGloballyDisabled = isButtonDisabled || showProcessingIndicator;

  return (
    <Container withSafeArea>
      <AppBar
        title={mode.title}
        showBackButton
        // Disable back button while processing
        onBackPress={() => !isGloballyDisabled && router.back()}
      />
      <View style={styles.content}>
        {/* Mode Card */}
        <View style={styles.modeCardContainer}>
          <ModeCard
            id={mode.id}
            mode={mode.id}
            title={mode.title}
            description={mode.description}
            color={mode.color}
            onPress={() => {}} // Non-interactive
          />
        </View>

        <View style={styles.divider} />

        {/* Recording Controls */}
        <View style={styles.controlsContainer}>
          <Text style={styles.modeLabelText}>Recording Mode</Text>
          <Toggle
            options={['Separate', 'Live']}
            selectedIndex={recordMode === 'separate' ? 0 : 1}
            onChange={handleToggleMode}
            // Disable toggle during recording or processing
            disabled={isRecording || isGloballyDisabled}
          />
        </View>

        {/* Partner Indicator for Separate Mode */}
        {recordMode === 'separate' && !showProcessingIndicator && ( // Hide during processing
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

        {/* Recording Button and Status */}
        <View style={styles.recordingContainer}>
          {showProcessingIndicator ? (
            <View style={styles.processingContainer}>
               <ActivityIndicator size="large" color={colors.primary} />
               <Text style={styles.processingText}>
                 {/* Adjust text based on recording state */} 
                 {isRecording ? 'Processing stop...' : (serverId ? 'Finishing up...' : 'Processing...')}
               </Text>
            </View>
          ) : (
            <>
              <RecordButton
                isRecording={isRecording}
                onPress={handleToggleRecording}
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

        {/* Waveform Visualization */}
        {!showProcessingIndicator && ( // Hide waveform during processing
            <View style={styles.waveformContainer}>
              <AudioWaveform isActive={isRecording} />
            </View>
        )}
      </View>
    </Container>
  );
}

// Helper function for mode details (replace with store/API in production)
function getModeDetails(id: string): Mode {
  const modes: Record<string, Mode> = {
    mediator: { id: 'mediator', title: 'Mediator', description: 'Get balanced insights', color: '#58BD7D' },
    counselor: { id: 'counselor', title: "Who's Right", description: 'Get a clear verdict', color: '#3B71FE' },
    dinner: { id: 'dinner', title: 'Dinner Planner', description: 'Decide what to eat', color: '#4BC9F0' },
    movie: { id: 'movie', title: 'Movie Night', description: 'Find something to watch', color: '#FF6838' },
  };
  return modes[id] || { id, title: 'Recording', description: 'Record your conversation', color: '#3B71FE' };
}

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