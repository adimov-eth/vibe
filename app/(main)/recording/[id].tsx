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
  const [isWaitingForUpload, setIsWaitingForUpload] = useState(false); // State to track upload monitoring phase

  // Recording flow hook
  const {
    localId,
    recordMode,
    currentPartner,
    isRecording,
    isProcessingLocally,
    isFlowCompleteLocally, // Get local completion signal
    handleToggleMode,
    handleToggleRecording,
    error: recordingError, // Rename to avoid clash with potential upload error state
    cleanup,
  } = useRecordingFlow({ modeId });

  // Get relevant state from Zustand store for monitoring
  const serverId = useStore(useCallback(state => state.localToServerIds[localId], [localId]));
  const uploadResults = useStore(state => state.uploadResults);
  const pendingUploads = useStore(state => state.pendingUploads); // Needed to know if upload is still pending


  // Effect to start waiting for uploads when local flow is done
  useEffect(() => {
    if (isFlowCompleteLocally) {
      console.log(`[RecordingScreen] Local flow complete for localId: ${localId}. Starting to wait for uploads.`);
      setIsWaitingForUpload(true);
    }
  }, [isFlowCompleteLocally, localId]);

  // Effect to monitor upload status and navigate on completion
  useEffect(() => {
    // Only monitor if we are in the "waiting" state and have a server ID
    if (!isWaitingForUpload || !serverId) {
      return; // Don't monitor if not waiting or serverId not yet mapped
    }

    console.log(`[RecordingScreen] Upload Monitor: Actively monitoring uploads for serverId: ${serverId}`);

    const requiredKeys = recordMode === 'live' ? ['live'] : ['1', '2'];
    let allSuccessful = true;
    let uploadsFound = 0;
    let stillPending = false;

    for (const key of requiredKeys) {
      const uploadId = `${serverId}_${key}`;
      const result = uploadResults[uploadId];

      if (result) {
        uploadsFound++;
        if (!result.success) {
           console.warn(`[RecordingScreen] Upload Monitor: Upload failed for ${uploadId}: ${result.error}`);
          allSuccessful = false;
          setIsWaitingForUpload(false); // Stop waiting on failure
          // TODO: Display upload error to user?
          break;
        } else {
           console.log(`[RecordingScreen] Upload Monitor: Upload result SUCCESS for ${uploadId}`);
        }
      } else {
        // Check if it's still in pendingUploads (meaning upload hasn't finished/failed yet)
        const isPending = pendingUploads.some(p => p.localConversationId === localId && p.audioKey === key);
        if (isPending) {
            console.log(`[RecordingScreen] Upload Monitor: Upload result for ${uploadId} not yet available, still pending.`);
            stillPending = true;
        } else {
             console.log(`[RecordingScreen] Upload Monitor: Upload result for ${uploadId} not available and not pending.`);
        }
        allSuccessful = false; // Mark as not complete if result missing
      }
    }

    // Navigate only if we found results for all required keys and all were successful
    if (uploadsFound === requiredKeys.length && allSuccessful) {
      console.log(`[RecordingScreen] Upload Monitor: All uploads successful for ${serverId}. Navigating...`);
      // Ensure we stop waiting state before navigating, though component will unmount
      setIsWaitingForUpload(false);
      router.replace(`../results/${serverId}`);
    } else if (uploadsFound < requiredKeys.length && !stillPending) {
        // Edge case: some results missing but none are pending? Could indicate an issue.
        console.warn(`[RecordingScreen] Upload Monitor: Waiting for uploads, found ${uploadsFound}/${requiredKeys.length}, but none seem pending.`);
    }
     else {
        console.log(`[RecordingScreen] Upload Monitor: Still waiting for uploads (Found: ${uploadsFound}/${requiredKeys.length}, AllSuccessful: ${allSuccessful}, StillPending: ${stillPending})`);
     }

  // Monitor changes in serverId mapping, upload results, pending uploads list, and waiting state
  }, [serverId, recordMode, uploadResults, pendingUploads, localId, router, isWaitingForUpload]);


  // Load mode details
  useEffect(() => {
    setMode(getModeDetails(modeId));
  }, [modeId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("[RecordingScreen] Component unmounting. Running cleanup.");
      void cleanup();
    };
  }, [cleanup]);

  // Determine overall error state
  const displayError = recordingError; // Add logic here if upload errors should also be displayed

  // UI Rendering Logic
  const showProcessingIndicator = isProcessingLocally;
  const showUploadingIndicator = isWaitingForUpload && !displayError; // Show upload wait only if actively waiting and no error

  return (
    <Container withSafeArea>
      <AppBar
        title={mode.title}
        showBackButton
        // Disable back button while processing/uploading?
        onBackPress={() => !(showProcessingIndicator || showUploadingIndicator) && router.back()}
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
            onPress={() => {}} // Make non-interactive?
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
            // Disable toggle during recording, processing, or waiting for upload
            disabled={isRecording || showProcessingIndicator || showUploadingIndicator}
          />
        </View>

        {/* Partner Indicator for Separate Mode */}
        {recordMode === 'separate' && !showUploadingIndicator && ( // Hide during upload wait
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
          {showProcessingIndicator || showUploadingIndicator ? (
            <View style={styles.processingContainer}>
               <ActivityIndicator size="large" color={colors.primary} />
               <Text style={styles.processingText}>
                 {showProcessingIndicator ? 'Processing...' : 'Uploading...'}
               </Text>
            </View>
          ) : (
            <>
              <RecordButton
                isRecording={isRecording}
                onPress={handleToggleRecording}
                // Disable button if already completed locally? Handled by parent view state?
              />
              <Text style={styles.recordingInstructions}>
                 {isRecording ? 'Recording... Tap to stop' : 'Tap to start recording'}
              </Text>
              {displayError && ( // Show error if present
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{displayError}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Waveform Visualization */}
        {/* Hide waveform when processing or uploading */}
        {!showProcessingIndicator && !showUploadingIndicator && (
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
  recordingInstructions: { ...typography.body2, color: colors.mediumText, marginTop: spacing.md },
  errorContainer: { backgroundColor: `${colors.error}20`, borderRadius: 8, padding: spacing.md, marginTop: spacing.md },
  errorText: { ...typography.body2, color: colors.error, textAlign: 'center' },
  waveformContainer: { height: 120, marginVertical: spacing.lg },
  processingContainer: { alignItems: 'center' },
  processingText: { ...typography.body2, color: colors.mediumText, marginTop: spacing.md },
  progressContainer: { width: '80%', marginTop: spacing.md },
  progressBackground: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: colors.primary },
  progressText: { ...typography.caption, textAlign: 'center', marginTop: spacing.xs },
});