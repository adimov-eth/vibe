import { Audio } from "expo-av";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system";
import { useCallback, useEffect, useState } from "react";
import useStore from "../state/index";
import { useUsage } from "./useUsage";

interface UseRecordingFlowProps {
  modeId: string;
  // No callback prop needed
}

// Define the return type of the hook
interface RecordingFlowResult {
  localId: string;
  recordMode: 'separate' | 'live';
  currentPartner: 1 | 2;
  isRecording: boolean;
  isProcessingLocally: boolean;
  isFlowCompleteLocally: boolean; // Signal local completion
  isButtonDisabled: boolean; // <-- Add button disable state
  handleToggleMode: (index: number) => void;
  handleToggleRecording: () => Promise<void>;
  error: string | null;
  cleanup: () => Promise<void>;
}

export const useRecordingFlow = ({ modeId }: UseRecordingFlowProps): RecordingFlowResult => {
  // Local state
  const [localId] = useState(Crypto.randomUUID());
  const [recordMode, setRecordMode] = useState<'separate' | 'live'>('separate');
  const [currentPartner, setCurrentPartner] = useState<1 | 2>(1);
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<string[]>([]);
  const [isProcessingLocally, setIsProcessingLocally] = useState(false);
  const [isFlowCompleteLocally, setIsFlowCompleteLocally] = useState(false); // New state
  const [error, setError] = useState<string | null>(null);
  const [recordingObject, setRecordingObject] = useState<Audio.Recording | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Audio.PermissionStatus | null>(null);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false); // <-- New state for button disabling

  const { checkCanCreateConversation } = useUsage();
  const store = useStore();

  // Set up audio mode
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (err) {
        console.error('Failed to set audio mode:', err);
        setError('Failed to initialize audio recording');
      }
    };

    setupAudio();

    // Cleanup audio mode on unmount
    return () => {
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      }).catch(console.error);
    };
  }, []);

  // Check and request permissions (called explicitly now)
  const checkPermissions = async (): Promise<boolean> => {
    try {
      const { status: currentStatus } = await Audio.getPermissionsAsync();
      setPermissionStatus(currentStatus); // Still useful to store status

      if (currentStatus !== 'granted') {
        console.log("[useRecordingFlow] Requesting microphone permission...");
        const { status: newStatus } = await Audio.requestPermissionsAsync();
        console.log(`[useRecordingFlow] Permission request result: ${newStatus}`);
        setPermissionStatus(newStatus);
        return newStatus === 'granted';
      }

      return true;
    } catch (err) {
      console.error('Permission check/request failed:', err);
      setError('Failed to check microphone permissions');
      return false;
    }
  };

  // Enhanced cleanup function - Stable dependencies
  const cleanup = useCallback(async () => {
    console.log("[useRecordingFlow] cleanup() called.");
    // Get latest state directly if needed, but prefer function arguments if possible
    const currentRecordingObject = recordingObject; // Capture current value
    const currentIsRecording = isRecording; // Capture current value
    const currentRecordings = recordings; // Capture current value

    try {
      if (currentRecordingObject) {
        if (currentIsRecording) {
          console.log("[useRecordingFlow] cleanup: Stopping and unloading active recording object.");
          try {
             await currentRecordingObject.stopAndUnloadAsync();
          } catch (stopErr) {
              console.warn("[useRecordingFlow] cleanup: Error during stopAndUnloadAsync:", stopErr);
              // Attempt cleanup even if stop fails
              try {
                  await currentRecordingObject._cleanupForUnloadedRecorder();
              } catch(cleanupErr){
                  console.warn("[useRecordingFlow] cleanup: Error during _cleanupForUnloadedRecorder after stop error:", cleanupErr);
              }
          }
        } else {
            console.log("[useRecordingFlow] cleanup: Cleaning up unloaded recording object.");
             try {
                  await currentRecordingObject._cleanupForUnloadedRecorder();
             } catch(cleanupErr){
                  console.warn("[useRecordingFlow] cleanup: Error during _cleanupForUnloadedRecorder:", cleanupErr);
             }
        }
      }
      // REMOVED: Button timeout clearing
    } catch (err) {
      console.error('[useRecordingFlow] Cleanup failed:', err);
    } finally {
      console.log("[useRecordingFlow] cleanup: Resetting state.");
      setRecordingObject(null); // Reset state setter
      setIsRecording(false); // Reset state setter

      // Clean up any temporary recording files
      if (currentRecordings.length > 0) {
          console.log(`[useRecordingFlow] cleanup: Deleting ${currentRecordings.length} temporary files.`);
          currentRecordings.forEach(async (uri) => {
            try {
              const fileInfo = await FileSystem.getInfoAsync(uri);
              if (fileInfo.exists) {
                await FileSystem.deleteAsync(uri, { idempotent: true });
                // console.log(`[useRecordingFlow] cleanup: Deleted ${uri}`); // Verbose
              }
            } catch (deleteErr) {
              console.error('[useRecordingFlow] cleanup: Failed to delete recording file:', deleteErr);
            }
          });
          setRecordings([]); // Reset state setter
      }
       // Ensure button is re-enabled on cleanup if it was disabled
      setIsButtonDisabled(false); // Reset state setter
      setIsFlowCompleteLocally(false); // Reset completion state setter
      setIsProcessingLocally(false); // Reset processing state setter
      setError(null); // Clear any errors
    }
  }, [recordings, isRecording, recordingObject]); // Keep dependencies for capturing current values

  // Toggle recording mode
  const handleToggleMode = (index: number) => {
    // Only check core states, not button disable
    if (isRecording || isProcessingLocally || isFlowCompleteLocally) return;

    // REMOVED: Button disable timeout logic

    setRecordMode(index === 0 ? 'separate' : 'live');
    setRecordings([]);
    setCurrentPartner(1);
    setError(null);
    setIsFlowCompleteLocally(false); // Reset completion
  };

  // Start/stop recording with enhanced error handling and simplified button logic
  const handleToggleRecording = async () => {
     if (isButtonDisabled) return; // Still prevent clicks if already processing

    setIsButtonDisabled(true); // Disable button for the duration of the async operation

    if (isRecording) {
      // --- Stop Recording ---
      try {
        setIsProcessingLocally(true); // Indicate processing starts
        setIsRecording(false); // Update state: no longer recording

        if (!recordingObject) {
            console.warn("[useRecordingFlow] Stop called but recordingObject is null.");
            // Attempt cleanup and reset state
            await cleanup();
            return; // Exit early
        }

        await recordingObject.stopAndUnloadAsync();
        const uri = recordingObject.getURI();
        setRecordingObject(null); // Clear the recording object *after* getting URI

        if (!uri) {
           console.error('[useRecordingFlow] Recording URI not found after stopping.');
           throw new Error('Recording URI not found');
        }

        console.log(`[useRecordingFlow] Recording stopped. URI: ${uri}`);
        setRecordings((prev) => [...prev, uri]);


        const audioKey = recordMode === 'live' ? 'live' : currentPartner.toString();

        // Check if server ID is known, log warning if not
        if (!store.localToServerIds[localId]) {
           console.warn(`[useRecordingFlow] Server ID for local ID ${localId} not found when saving upload intent. Conversation creation might be pending or failed.`);
           // Critical check: if it's the first recording stopping and no serverId, likely creation failed earlier
           if (recordings.length === 0 && currentPartner === 1) { // Check length *before* the state update above finishes
                 console.error("[useRecordingFlow] Critical: Server ID missing after first recording stopped. Conversation creation likely failed.");
                 setError("Failed to associate recording with a conversation.");
                 // Don't proceed further if we can't associate the recording
                 setIsProcessingLocally(false); // Ensure processing state is cleared
                 await cleanup(); // Clean up the recording file etc.
                 return;
           }
        }

        // Proceed to save intent regardless of warning
        await store.saveUploadIntent(localId, uri, audioKey);
        console.log(`[useRecordingFlow] Saved upload intent for localId ${localId}, audioKey ${audioKey}`);

        const isLastRecordingStep = !(recordMode === 'separate' && currentPartner === 1);

        if (isLastRecordingStep) {
           console.log('[useRecordingFlow] Last recording step finished locally. Setting isFlowCompleteLocally=true.');
           setIsFlowCompleteLocally(true); // Signal local completion
        } else {
          setCurrentPartner(2);
          console.log('[useRecordingFlow] Separate mode: Switched to Partner 2.');
        }

      } catch (err) {
        setError(`Failed to stop recording: ${err instanceof Error ? err.message : String(err)}`);
        console.error('[useRecordingFlow] Error stopping recording:', err);
        // Attempt cleanup on error
        await cleanup();
        // Ensure flags are reset even if cleanup fails partially
        setIsProcessingLocally(false);
        setIsFlowCompleteLocally(false);
        setIsRecording(false); // Ensure recording state is false

      } finally {
        // Ensure processing state is off and button is enabled regardless of success/error
        setIsProcessingLocally(false);
        setIsButtonDisabled(false);
      }
    } else {
      // --- Start Recording ---
      let conversationCreated = false; // Track if creation was attempted
      try {
        // Reset potentially stale states
        setIsFlowCompleteLocally(false);
        setIsProcessingLocally(false);
        setError(null);

        // 1. Check Usage
        const canCreate = await checkCanCreateConversation();
        if (!canCreate) {
          setError('Usage limit reached or subscription required');
          setIsButtonDisabled(false); // Re-enable button immediately
          return;
        }

        // 2. Check Permissions
        const hasPermission = await checkPermissions();
        if (!hasPermission) {
          setError('Microphone permission denied');
           setIsButtonDisabled(false); // Re-enable button immediately
          return;
        }

        // 3. Create Conversation (only if it's the very first recording attempt for this flow instance)
        if (recordings.length === 0 && currentPartner === 1 && !store.localToServerIds[localId]) {
           console.log(`[useRecordingFlow] First recording started. Creating conversation with localId: ${localId}`);
           conversationCreated = true; // Mark that we are attempting creation
           await store.createConversation(modeId, recordMode, localId);
           // No need to wait for the serverId here, setLocalToServerId handles triggering uploads
           console.log(`[useRecordingFlow] Conversation creation initiated for localId: ${localId}.`);
        }

        // 4. Prepare and Start Recording
        console.log('[useRecordingFlow] Preparing and starting recording...');
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY_LOW_LATENCY); // Use a preset suitable for voice
        // Note: HIGH_QUALITY_LOW_LATENCY defaults should be reasonable for m4a on both platforms

        setRecordingObject(recording); // Store the recording object *before* starting

        await recording.startAsync();
        setIsRecording(true); // Update state: now recording
        console.log('[useRecordingFlow] Recording started successfully.');

      } catch (err) {
        setError(`Failed to start recording: ${err instanceof Error ? err.message : String(err)}`);
        console.error('[useRecordingFlow] Error starting recording:', err);
        // Attempt cleanup on error
        await cleanup();
         // Ensure flags are reset even if cleanup fails partially
        setIsRecording(false); // Ensure recording state is false
        setRecordingObject(null);
        // If conversation creation was attempted and failed, the error might be from store.createConversation
        if (conversationCreated) {
             console.error("[useRecordingFlow] Conversation creation might have failed.");
             // Error state is already set
        }
      } finally {
          // Ensure button is re-enabled regardless of success/error during start
          setIsButtonDisabled(false);
      }
    }
  };

  // Cleanup on unmount - stable callback ensures effect runs only once
  const stableCleanup = useCallback(async () => {
    await cleanup();
  }, [cleanup]); // Dependency array includes the useCallback-wrapped cleanup

  useEffect(() => {
     console.log("[useRecordingFlow] Mount effect: Running initial permission check.");
     checkPermissions(); // Check permissions once on mount

    return () => {
      console.log("[useRecordingFlow] Unmount effect: Calling stableCleanup.");
      stableCleanup().catch(console.error);
    };
  }, [stableCleanup]); // Ensure this runs only on mount/unmount

  return {
    localId,
    recordMode,
    currentPartner,
    isRecording,
    isProcessingLocally,
    isFlowCompleteLocally,
    isButtonDisabled,
    handleToggleMode,
    handleToggleRecording,
    error,
    cleanup: stableCleanup, // Return the stable cleanup function
  };
}; 