import { Audio } from "expo-av";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [isFlowCompleteLocally, setIsFlowCompleteLocally] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingObject, setRecordingObject] = useState<Audio.Recording | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Audio.PermissionStatus | null>(null);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);

  // Ref to track if cleanup is already in progress to prevent overlaps
  const cleanupInProgress = useRef(false);

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

  // Enhanced cleanup function
  const cleanup = useCallback(async () => {
    // Prevent overlapping cleanup calls
    if (cleanupInProgress.current) {
        console.log("[useRecordingFlow] cleanup: Already in progress, skipping.");
        return;
    }
    console.log("[useRecordingFlow] cleanup: Starting cleanup process.");
    cleanupInProgress.current = true;

    // Get latest state values INSIDE the cleanup function
    // Using state directly is okay here as we want the most current value during execution
    const currentRecordingObject = recordingObject; // Capture current value
    const currentIsRecording = isRecording; // Capture current value
    const currentRecordings = recordings; // Capture current value

    try {
      if (currentRecordingObject) {
          // Check status BEFORE trying to stop/unload
          const status = await currentRecordingObject.getStatusAsync();
          console.log(`[useRecordingFlow] cleanup: Recording object status: ${JSON.stringify(status)}`);

          if (status.isRecording) {
              console.log("[useRecordingFlow] cleanup: Status indicates recording. Stopping and unloading...");
              try {
                  await currentRecordingObject.stopAndUnloadAsync();
                  console.log("[useRecordingFlow] cleanup: Stop and unload successful.");
              } catch (stopErr) {
                  console.warn("[useRecordingFlow] cleanup: Error during stopAndUnloadAsync:", stopErr);
                  // Attempt internal cleanup method as a fallback
                  try {
                      // Note: This is an internal method and might change/break
                      // @ts-ignore _cleanupForUnloadedRecorder is not in public API type
                      if (typeof currentRecordingObject._cleanupForUnloadedRecorder === 'function') {
                          // @ts-ignore
                          await currentRecordingObject._cleanupForUnloadedRecorder();
                          console.log("[useRecordingFlow] cleanup: Fallback internal cleanup called after stop error.");
                      }
                  } catch(cleanupErr){
                      console.warn("[useRecordingFlow] cleanup: Error during fallback internal cleanup:", cleanupErr);
                  }
              }
          } else if (status.isDoneRecording && status.canRecord) {
               // It might be stopped but not fully unloaded (e.g., if stopAndUnloadAsync was interrupted)
               console.log("[useRecordingFlow] cleanup: Status indicates stopped but maybe not unloaded. Attempting unload/cleanup.");
                try {
                    // Note: This is an internal method and might change/break
                    // @ts-ignore _cleanupForUnloadedRecorder is not in public API type
                    if (typeof currentRecordingObject._cleanupForUnloadedRecorder === 'function') {
                        // @ts-ignore
                        await currentRecordingObject._cleanupForUnloadedRecorder();
                        console.log("[useRecordingFlow] cleanup: Fallback internal cleanup called for stopped state.");
                    } else {
                         // If internal method isn't available, try unloading again just in case
                         await currentRecordingObject.stopAndUnloadAsync();
                         console.log("[useRecordingFlow] cleanup: Retried stopAndUnloadAsync for stopped state.");
                    }
                } catch(cleanupErr){
                    console.warn("[useRecordingFlow] cleanup: Error during unload/cleanup for stopped state:", cleanupErr);
                }
          } else {
               console.log("[useRecordingFlow] cleanup: Recording object status doesn't require stop/unload action.");
          }
      } else {
          console.log("[useRecordingFlow] cleanup: No recording object found in state.");
      }
    } catch (err) {
      console.error('[useRecordingFlow] Cleanup failed:', err);
    } finally {
      console.log("[useRecordingFlow] cleanup: Resetting state variables.");
      // Reset state setters
      setRecordingObject(null);
      setIsRecording(false);

      // Clean up any temporary recording files
      if (currentRecordings.length > 0) {
          console.log(`[useRecordingFlow] cleanup: Deleting ${currentRecordings.length} temporary files.`);
          // Use Promise.allSettled for better error handling of individual deletions
          const deletePromises = currentRecordings.map(async (uri) => {
            try {
              const fileInfo = await FileSystem.getInfoAsync(uri);
              if (fileInfo.exists) {
                await FileSystem.deleteAsync(uri, { idempotent: true });
                // console.log(`[useRecordingFlow] cleanup: Deleted ${uri}`); // Verbose
              }
              return { status: 'fulfilled', uri };
            } catch (deleteErr) {
              console.error(`[useRecordingFlow] cleanup: Failed to delete recording file ${uri}:`, deleteErr);
              return { status: 'rejected', uri, reason: deleteErr };
            }
          });
          await Promise.allSettled(deletePromises);
          setRecordings([]);
      }

      setIsButtonDisabled(false);
      setIsFlowCompleteLocally(false);
      setIsProcessingLocally(false);
      setError(null);

      // Release the lock
      cleanupInProgress.current = false;
      console.log("[useRecordingFlow] cleanup: Finished cleanup process.");
    }
  // Update dependencies: Add the state variables read directly inside
  }, [recordings, isRecording, recordingObject]);

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
     // Use ref to prevent clicks if cleanup is running
     if (isButtonDisabled || cleanupInProgress.current) {
         console.log(`[useRecordingFlow] handleToggleRecording: Button press ignored (disabled: ${isButtonDisabled}, cleanup: ${cleanupInProgress.current})`);
         return;
     }

    setIsButtonDisabled(true); // Disable button early

    if (isRecording) {
      // --- Stop Recording ---
      console.log("[useRecordingFlow] handleToggleRecording: Stopping recording...");
      try {
        // Get current recording object from state *before* potential state changes
        const currentRecObject = recordingObject;

        // Set states immediately
        setIsProcessingLocally(true);
        setIsRecording(false); // Optimistic UI update

        if (!currentRecObject) {
            console.warn("[useRecordingFlow] Stop called but recordingObject state is null.");
            // Attempt cleanup and reset state - avoid calling cleanup directly if stopping failed early
            setIsProcessingLocally(false);
            setIsButtonDisabled(false); // Re-enable button
            return; // Exit early
        }

        await currentRecObject.stopAndUnloadAsync();
        const uri = currentRecObject.getURI();
        setRecordingObject(null); // Clear the recording object *after* getting URI and stopping

        if (!uri) {
           console.error('[useRecordingFlow] Recording URI not found after stopping.');
           throw new Error('Recording URI not found');
        }

        console.log(`[useRecordingFlow] Recording stopped. URI: ${uri}`);
        const newRecordings = [...recordings, uri];
        setRecordings(newRecordings); // Update recordings state


        const audioKey = recordMode === 'live' ? 'live' : currentPartner.toString();

        const currentServerId = store.localToServerIds[localId];
        if (!currentServerId) {
           console.warn(`[useRecordingFlow] Server ID for local ID ${localId} not found when saving upload intent.`);
           if (newRecordings.length === 1 && currentPartner === 1) {
                 console.error("[useRecordingFlow] Critical: Server ID missing after first recording stopped.");
                 setError("Failed to associate recording with a conversation.");
                 setIsProcessingLocally(false);
                 await cleanup(); // Full cleanup needed here
                 return;
           }
        }

        // Use await here to ensure intent is saved before checking completion logic
        await store.saveUploadIntent(localId, uri, audioKey);
        console.log(`[useRecordingFlow] Saved upload intent for localId ${localId}, audioKey ${audioKey}`);

        const isLastRecordingStep = !(recordMode === 'separate' && currentPartner === 1);

        if (isLastRecordingStep) {
           console.log('[useRecordingFlow] Last recording step finished locally. Setting isFlowCompleteLocally=true.');
           setIsFlowCompleteLocally(true);
        } else {
          setCurrentPartner(2);
          console.log('[useRecordingFlow] Separate mode: Switched to Partner 2.');
        }

      } catch (err) {
        setError(`Failed to stop recording: ${err instanceof Error ? err.message : String(err)}`);
        console.error('[useRecordingFlow] Error stopping recording:', err);
        // Attempt FULL cleanup on stop error
        await cleanup();
        // Ensure flags are reset AFTER cleanup attempts
        setIsProcessingLocally(false);
        setIsFlowCompleteLocally(false);
        setIsRecording(false); // Ensure recording state is false
        setIsButtonDisabled(false); // Ensure button is enabled


      } finally {
        // Redundant? Cleanup should handle this, but ensure processing is off
        setIsProcessingLocally(false);
         // Ensure button is enabled unless flow is complete (handled elsewhere) or error occurred (handled above)
        if (!isFlowCompleteLocally && !error) {
             setIsButtonDisabled(false);
        }
      }
    } else {
      // --- Start Recording ---
      console.log("[useRecordingFlow] handleToggleRecording: Starting recording...");
      let conversationCreated = false;
      try {
        // Reset potentially stale states *before* checks
        setIsFlowCompleteLocally(false);
        setIsProcessingLocally(false);
        setError(null);

        // **Critical Check:** Ensure previous recording object is null before proceeding
        if (recordingObject) {
            console.warn("[useRecordingFlow] Start called but recordingObject state is not null. Attempting cleanup first.");
            await cleanup(); // Attempt cleanup before starting
            // Check again after cleanup
            if (recordingObject) {
                 console.error("[useRecordingFlow] Start failed: Cleanup did not clear recordingObject.");
                 throw new Error("Failed to cleanup previous recording instance.");
            }
        }


        // 1. Check Usage
        const canCreate = await checkCanCreateConversation();
        if (!canCreate) {
          setError('Usage limit reached or subscription required');
          setIsButtonDisabled(false);
          return;
        }

        // 2. Check Permissions
        const hasPermission = await checkPermissions();
        if (!hasPermission) {
          setError('Microphone permission denied');
          setIsButtonDisabled(false);
          return;
        }

        // 3. Create Conversation (only if first recording attempt)
        // Check recordings length AND partner state
        if (recordings.length === 0 && currentPartner === 1 && !store.localToServerIds[localId]) {
           console.log(`[useRecordingFlow] First recording started. Creating conversation with localId: ${localId}`);
           conversationCreated = true;
           await store.createConversation(modeId, recordMode, localId);
           console.log(`[useRecordingFlow] Conversation creation initiated for localId: ${localId}.`);
        }

        // 4. Prepare and Start Recording
        console.log('[useRecordingFlow] Preparing and starting recording...');
        const recording = new Audio.Recording();
        // Set recording options explicitly for potentially better cross-platform consistency
        await recording.prepareToRecordAsync({
             ...Audio.RecordingOptionsPresets.HIGH_QUALITY, // Start with high quality preset
             android: {
                 ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
                 numberOfChannels: 1, // Explicitly mono
             },
             ios: {
                 ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
                 numberOfChannels: 1, // Explicitly mono
                 // audioQuality: Audio.IOSAudioQuality.MAX, // Consider MAX if needed, HIGH is usually good
             }
        });
        console.log('[useRecordingFlow] Recording prepared.');

        setRecordingObject(recording); // Store the recording object *before* starting

        await recording.startAsync();
        setIsRecording(true); // Update state AFTER successful start
        console.log('[useRecordingFlow] Recording started successfully.');

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to start recording: ${errorMessage}`);
        console.error('[useRecordingFlow] Error starting recording:', err);
        // Attempt FULL cleanup on start error
        await cleanup();
        // Ensure flags are reset AFTER cleanup attempt
        setIsRecording(false);
        setRecordingObject(null); // Ensure object is cleared from state
        setIsButtonDisabled(false); // Ensure button is enabled

        if (conversationCreated) {
             console.error("[useRecordingFlow] Conversation creation might have failed.");
        }
      } finally {
          // Ensure button is re-enabled ONLY if not currently recording
          // (it might have been enabled in the catch block already)
          if (!recordingObject) { // Use the local state variable directly
             setIsButtonDisabled(false);
          }
      }
    }
  };

  // Cleanup on unmount - stable callback ensures effect runs only once
  const stableCleanup = useCallback(async () => {
      await cleanup();
  }, [cleanup]);

  useEffect(() => {
     console.log("[useRecordingFlow] Mount effect: Running initial permission check.");
     checkPermissions(); // Check permissions once on mount

    return () => {
      console.log("[useRecordingFlow] Unmount effect: Calling stableCleanup.");
      // Don't await here, just fire and forget
      stableCleanup().catch(err => console.error("[useRecordingFlow] Error during unmount cleanup:", err));
    };
  // stableCleanup depends on cleanup, which now depends on state variables too
  // Let's simplify the dependency array for the mount/unmount effect
  // It should only depend on the stable cleanup function itself.
  }, [stableCleanup]);


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

// Helper to get latest state if needed outside of setters
function get() {
    return useStore.getState();
} 