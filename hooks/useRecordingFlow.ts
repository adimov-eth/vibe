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
  cleanup: () => Promise<void>; // Keep cleanup export for potential manual calls
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

  // Refs to hold latest state for cleanup without causing effect dependency issues
  const recordingObjectRef = useRef<Audio.Recording | null>(null);
  const recordingsRef = useRef<string[]>([]);
  const isRecordingRef = useRef<boolean>(false);

  // Keep refs updated
  useEffect(() => {
      recordingObjectRef.current = recordingObject;
      recordingsRef.current = recordings;
      isRecordingRef.current = isRecording;
  }, [recordingObject, recordings, isRecording]);


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

  // Enhanced cleanup function - Reads state via refs now
  // No dependencies needed as it reads refs directly when called
  const cleanup = useCallback(async () => {
    if (cleanupInProgress.current) {
        console.log("[useRecordingFlow] cleanup: Already in progress, skipping.");
        return;
    }
    console.log("[useRecordingFlow] cleanup: Starting cleanup process.");
    cleanupInProgress.current = true;

    // Get latest state values using refs INSIDE the cleanup function
    const currentRecordingObject = recordingObjectRef.current;
    // const currentIsRecording = isRecordingRef.current; // Not directly needed below
    const currentRecordings = recordingsRef.current;

    try {
      if (currentRecordingObject) {
          const status = await currentRecordingObject.getStatusAsync();
          console.log(`[useRecordingFlow] cleanup: Recording object status: ${JSON.stringify(status)}`);

          if (status.isRecording) {
              console.log("[useRecordingFlow] cleanup: Status indicates recording. Stopping and unloading...");
              try {
                  await currentRecordingObject.stopAndUnloadAsync();
                  console.log("[useRecordingFlow] cleanup: Stop and unload successful.");
              } catch (stopErr) {
                  console.warn("[useRecordingFlow] cleanup: Error during stopAndUnloadAsync:", stopErr);
                  try {
                      // @ts-ignore
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
               console.log("[useRecordingFlow] cleanup: Status indicates stopped but maybe not unloaded. Attempting unload/cleanup.");
                try {
                    // @ts-ignore
                    if (typeof currentRecordingObject._cleanupForUnloadedRecorder === 'function') {
                        // @ts-ignore
                        await currentRecordingObject._cleanupForUnloadedRecorder();
                        console.log("[useRecordingFlow] cleanup: Fallback internal cleanup called for stopped state.");
                    } else {
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
          console.log("[useRecordingFlow] cleanup: No recording object found in ref.");
      }
    } catch (err) {
      console.error('[useRecordingFlow] Cleanup failed:', err);
    } finally {
      console.log("[useRecordingFlow] cleanup: Resetting state variables.");
      // Reset state setters
      setRecordingObject(null);
      setIsRecording(false);

      if (currentRecordings.length > 0) {
          console.log(`[useRecordingFlow] cleanup: Deleting ${currentRecordings.length} temporary files.`);
          const deletePromises = currentRecordings.map(async (uri) => {
            try {
              const fileInfo = await FileSystem.getInfoAsync(uri);
              if (fileInfo.exists) {
                await FileSystem.deleteAsync(uri, { idempotent: true });
              }
              return { status: 'fulfilled', uri };
            } catch (deleteErr) {
              console.error(`[useRecordingFlow] cleanup: Failed to delete recording file ${uri}:`, deleteErr);
              return { status: 'rejected', uri, reason: deleteErr };
            }
          });
          await Promise.allSettled(deletePromises);
          setRecordings([]); // Clear the state after deletion attempts
          recordingsRef.current = []; // Clear the ref as well
      }

      setIsButtonDisabled(false);
      setIsFlowCompleteLocally(false);
      setIsProcessingLocally(false);
      setError(null);
      setCurrentPartner(1); // Reset partner on cleanup

      cleanupInProgress.current = false;
      console.log("[useRecordingFlow] cleanup: Finished cleanup process.");
    }
  // Use empty dependency array for useCallback as it now only uses refs and setters
  }, []);

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
      let stopErrorOccurred = false; // Flag to track errors in this block
      try {
        // Get current recording object from state *before* potential state changes
        const currentRecObject = recordingObjectRef.current;

        // Set states immediately
        setIsProcessingLocally(true);
        setIsRecording(false); // Optimistic UI update

        if (!currentRecObject) {
            console.warn("[useRecordingFlow] Stop called but recordingObject ref is null.");
            // Attempt cleanup and reset state - avoid calling cleanup directly if stopping failed early
            setIsProcessingLocally(false);
            // setIsButtonDisabled(false); // Handled in finally
            stopErrorOccurred = true; // Treat this as an error for finally
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
        const newRecordings = [...recordingsRef.current, uri];
        setRecordings(newRecordings); // Update recordings state


        const audioKey = recordMode === 'live' ? 'live' : currentPartner.toString();

        const currentServerId = store.localToServerIds[localId];
        if (!currentServerId) {
           console.warn(`[useRecordingFlow] Server ID for local ID ${localId} not found when saving upload intent.`);
           if (newRecordings.length === 1 && currentPartner === 1) {
                 console.error("[useRecordingFlow] Critical: Server ID missing after first recording stopped.");
                 setError("Failed to associate recording with a conversation.");
                 setIsProcessingLocally(false);
                 await cleanup();
                 stopErrorOccurred = true; // Treat this as an error for finally
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
        stopErrorOccurred = true; // Mark error occurred
        setError(`Failed to stop recording: ${err instanceof Error ? err.message : String(err)}`);
        console.error('[useRecordingFlow] Error stopping recording:', err);
        // Attempt FULL cleanup on stop error
        await cleanup();
        // Ensure flags are reset AFTER cleanup attempts
        setIsProcessingLocally(false);
        setIsFlowCompleteLocally(false);
        setIsRecording(false); // Ensure recording state is false
        // setIsButtonDisabled(false); // Handled in finally


      } finally {
        // Always ensure processing is false after trying to stop
        setIsProcessingLocally(false);
         // Re-enable button if stop finished WITHOUT error AND the flow isn't complete
         if (!stopErrorOccurred && !isFlowCompleteLocally) {
             setIsButtonDisabled(false);
             console.log("[useRecordingFlow] Stop Recording finally: Re-enabled button.");
         } else {
              console.log(`[useRecordingFlow] Stop Recording finally: Button remains disabled (Error: ${stopErrorOccurred}, FlowComplete: ${isFlowCompleteLocally}) or handled by cleanup.`);
         }
      }
    } else {
      // --- Start Recording ---
      console.log("[useRecordingFlow] handleToggleRecording: Starting recording...");
      let conversationCreated = false;
      let startErrorOccurred = false; // Flag to track errors in this block
      try {
        // Reset potentially stale states *before* checks
        setIsFlowCompleteLocally(false);
        setIsProcessingLocally(false);
        setError(null); // Clear previous errors before starting

        // **Critical Check:** Ensure previous recording object is null before proceeding
        if (recordingObjectRef.current) {
            console.warn("[useRecordingFlow] Start called but recordingObject ref is not null. Attempting cleanup first.");
            await cleanup(); // Attempt cleanup before starting
            // Check again after cleanup
            if (recordingObjectRef.current) {
                 console.error("[useRecordingFlow] Start failed: Cleanup did not clear recordingObject ref.");
                 throw new Error("Failed to cleanup previous recording instance.");
            }
        }


        // 1. Check Usage
        const canCreate = await checkCanCreateConversation();
        if (!canCreate) {
          setError('Usage limit reached or subscription required');
          //   setIsButtonDisabled(false); // Handled in finally
          startErrorOccurred = true;
          return;
        }

        // 2. Check Permissions
        const hasPermission = await checkPermissions();
        if (!hasPermission) {
          setError('Microphone permission denied');
          //   setIsButtonDisabled(false); // Handled in finally
          startErrorOccurred = true;
          return;
        }

        // 3. Create Conversation (only if first recording attempt)
        // Check recordings length AND partner state
        if (recordingsRef.current.length === 0 && currentPartner === 1 && !store.localToServerIds[localId]) {
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
        startErrorOccurred = true; // Mark error occurred
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to start recording: ${errorMessage}`);
        console.error('[useRecordingFlow] Error starting recording:', err);
        // Attempt FULL cleanup on start error
        await cleanup();
        // Ensure flags are reset AFTER cleanup attempt
        setIsRecording(false);
        setRecordingObject(null); // Ensure object is cleared from state
        // setIsButtonDisabled(false); // Handled in finally

        if (conversationCreated) {
             console.error("[useRecordingFlow] Conversation creation might have failed.");
        }
      } finally {
          // Re-enable the button if starting was successful (no error occurred)
          if (!startErrorOccurred) {
             setIsButtonDisabled(false);
             console.log("[useRecordingFlow] Start Recording finally: Re-enabled button after successful start.");
          } else {
              // If an error occurred before startAsync, we might need to ensure it's false
              setIsButtonDisabled(false); // Ensure re-enabled on error path too
              console.log("[useRecordingFlow] Start Recording finally: Button re-enabled following error.");
          }
      }
    }
  };

  // Mount/Unmount Effect - Simplified Dependencies
  useEffect(() => {
     console.log("[useRecordingFlow] Mount effect: Running initial permission check.");
     checkPermissions(); // Check permissions once on mount

    // Define the cleanup logic directly in the return function
    // This function will have access to the `cleanup` function from the outer scope
    // which now uses refs and has a stable identity.
    return () => {
      console.log("[useRecordingFlow] Unmount effect: Calling cleanup.");
      // Use the stable cleanup function (which uses refs internally)
      cleanup().catch(err => console.error("[useRecordingFlow] Error during unmount cleanup:", err));
    };
  // Depend only on the `cleanup` function itself (which is stable due to useCallback([])).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanup]);


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
    cleanup, // Return the stable cleanup function
  };
};

// Helper to get latest state if needed outside of setters
// This helper might not be necessary anymore if refs handle most cases
// function get() {
//     return useStore.getState();
// } 