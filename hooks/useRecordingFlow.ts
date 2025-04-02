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

const BUTTON_DISABLE_DURATION = 1500; // 1.5 seconds

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
  const buttonTimeoutRef = useRef<NodeJS.Timeout | null>(null); // <-- Ref for timeout

  const { checkCanCreateConversation } = useUsage();
  const store = useStore();

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (buttonTimeoutRef.current) {
        clearTimeout(buttonTimeoutRef.current);
      }
    };
  }, []);

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

  // Check and request permissions
  const checkPermissions = async (): Promise<boolean> => {
    try {
      const { status: currentStatus } = await Audio.getPermissionsAsync();
      setPermissionStatus(currentStatus);
      
      if (currentStatus !== 'granted') {
        const { status: newStatus } = await Audio.requestPermissionsAsync();
        setPermissionStatus(newStatus);
        return newStatus === 'granted';
      }
      
      return true;
    } catch (err) {
      console.error('Permission check failed:', err);
      setError('Failed to check microphone permissions');
      return false;
    }
  };

  // Enhanced cleanup function
  const cleanup = useCallback(async () => {
    try {
      if (recordingObject) {
        if (isRecording) {
          await recordingObject.stopAndUnloadAsync();
        }
        await recordingObject._cleanupForUnloadedRecorder();
      }
      // Clear button disable timeout on cleanup
      if (buttonTimeoutRef.current) {
        clearTimeout(buttonTimeoutRef.current);
        buttonTimeoutRef.current = null;
      }
      setIsButtonDisabled(false); // Ensure button is re-enabled on cleanup
    } catch (err) {
      console.error('Cleanup failed:', err);
    } finally {
      setRecordingObject(null);
      setIsRecording(false);
      
      // Clean up any temporary recording files
      recordings.forEach(async (uri) => {
        try {
          const fileInfo = await FileSystem.getInfoAsync(uri);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(uri, { idempotent: true });
          }
        } catch (err) {
          console.error('Failed to delete recording file:', err);
        }
      });
      setRecordings([]);
    }
    setIsFlowCompleteLocally(false); // Reset on cleanup
  }, [recordings, isRecording, recordingObject]);

  // Toggle recording mode
  const handleToggleMode = (index: number) => {
    // Also check isButtonDisabled
    if (isRecording || isProcessingLocally || isFlowCompleteLocally || isButtonDisabled) return;

    // Disable button immediately
    setIsButtonDisabled(true);
    // Re-enable after delay
    buttonTimeoutRef.current = setTimeout(() => {
      setIsButtonDisabled(false);
      buttonTimeoutRef.current = null;
    }, BUTTON_DISABLE_DURATION);

    setRecordMode(index === 0 ? 'separate' : 'live');
    setRecordings([]);
    setCurrentPartner(1);
    setError(null);
    setIsFlowCompleteLocally(false); // Reset completion
  };

  // Start/stop recording with enhanced error handling
  const handleToggleRecording = async () => {
     // Also check isButtonDisabled
     if (isButtonDisabled) return;

    // Disable button immediately
    setIsButtonDisabled(true);
    // Schedule re-enable, will be cleared if processing takes longer
    buttonTimeoutRef.current = setTimeout(() => {
      // Only re-enable if not currently recording or processing
      if (!isRecording && !isProcessingLocally) {
         setIsButtonDisabled(false);
         buttonTimeoutRef.current = null;
      }
    }, BUTTON_DISABLE_DURATION);


    if (isRecording) {
      try {
        setIsProcessingLocally(true);
        setIsRecording(false);
        await recordingObject?.stopAndUnloadAsync();
        const uri = recordingObject?.getURI();
        if (!uri) throw new Error('Recording URI not found');

        console.log(`[useRecordingFlow] Recording stopped. URI: ${uri}`);

        setRecordings((prev) => [...prev, uri]);
        setRecordingObject(null);

        const audioKey = recordMode === 'live' ? 'live' : currentPartner.toString();

        if (!store.localToServerIds[localId]) {
           console.warn(`[useRecordingFlow] Server ID for local ID ${localId} not found when adding pending upload. Conversation creation might be pending.`);
           // Ensure conversation creation was at least initiated
            if (recordings.length === 1 && currentPartner === 1) { // Should have been created on first recording start
                 console.error("[useRecordingFlow] Critical: Server ID missing after first recording stopped.");
                 // Consider throwing error or setting an error state
            }
        }

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
        setIsProcessingLocally(false);

        // If processing finished faster than the delay, clear the timeout and re-enable now
        if (buttonTimeoutRef.current) {
          clearTimeout(buttonTimeoutRef.current);
          buttonTimeoutRef.current = null;
        }
        setIsButtonDisabled(false);


      } catch (err) {
        setError('Failed to stop recording');
        console.error('[useRecordingFlow] Error stopping recording:', err);
        await cleanup(); // Use stable cleanup
        setIsProcessingLocally(false);
        setIsFlowCompleteLocally(false); // Ensure reset on error
        // Ensure button is re-enabled on error
        if (buttonTimeoutRef.current) {
          clearTimeout(buttonTimeoutRef.current);
          buttonTimeoutRef.current = null;
        }
        setIsButtonDisabled(false);

      }
    } else {
      try {
        setIsFlowCompleteLocally(false); // Reset completion state
        setIsProcessingLocally(false);
        setError(null);

        const canCreate = await checkCanCreateConversation();
        if (!canCreate) {
          setError('Usage limit reached or subscription required');
           // Re-enable button immediately on usage limit error
           if (buttonTimeoutRef.current) clearTimeout(buttonTimeoutRef.current);
           setIsButtonDisabled(false);
           return;
        }
        const hasPermission = await checkPermissions();
        if (!hasPermission) {
          setError('Microphone permission denied');
          // Re-enable button immediately on permission error
          if (buttonTimeoutRef.current) clearTimeout(buttonTimeoutRef.current);
          setIsButtonDisabled(false);
          return;
        }

        // Create conversation only if it's the very first recording
        if (recordings.length === 0 && currentPartner === 1) {
           console.log(`[useRecordingFlow] First recording started. Creating conversation with localId: ${localId}`);
           // Initiate creation, don't necessarily wait
           store.createConversation(modeId, recordMode, localId)
             .then(serverId => {
                console.log(`[useRecordingFlow] Conversation created successfully. Server ID: ${serverId}`);
             })
             .catch(err => {
                 console.error("[useRecordingFlow] Failed to initiate conversation creation:", err);
                 setError("Failed to create conversation session.");
                 // Re-enable button immediately on creation error
                 if (buttonTimeoutRef.current) clearTimeout(buttonTimeoutRef.current);
                 setIsButtonDisabled(false);
             });
        }

        console.log('[useRecordingFlow] Preparing and starting recording...');
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync({
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          android: {
            ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
          },
          ios: {
            ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
            extension: '.m4a',
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            audioQuality: Audio.IOSAudioQuality.MAX,
          },
          keepAudioActiveHint: true,
        });
        await recording.startAsync();
        setRecordingObject(recording);
        setIsRecording(true);
        console.log('[useRecordingFlow] Recording started successfully.');

        // Recording started, keep button disabled via the timeout set earlier

      } catch (err) {
        setError('Failed to start recording');
        console.error('[useRecordingFlow] Error starting recording:', err);
        await cleanup(); // Use stable cleanup
        // Ensure button re-enabled on start error
        if (buttonTimeoutRef.current) clearTimeout(buttonTimeoutRef.current);
        setIsButtonDisabled(false);
      }
    }
  };

  // Monitor permission changes
  useEffect(() => {
    const checkCurrentPermission = async () => {
      const { status } = await Audio.getPermissionsAsync();
      if (status !== permissionStatus) {
        setPermissionStatus(status);
        if (status !== 'granted' && isRecording) {
          setError('Microphone permission revoked');
          await cleanup();
        }
      }
    };

    // Only check permissions if we're recording
    if (isRecording) {
      const interval = setInterval(checkCurrentPermission, 1000);
      return () => clearInterval(interval);
    }
  }, [permissionStatus, isRecording, cleanup]);

  // Cleanup on unmount - using useCallback to stabilize the cleanup function
  const stableCleanup = useCallback(async () => {
    await cleanup();
  }, [cleanup]);

  useEffect(() => {
    return () => {
      stableCleanup().catch(console.error);
    };
  }, [stableCleanup]);

  return {
    localId,
    recordMode,
    currentPartner,
    isRecording,
    isProcessingLocally,
    isFlowCompleteLocally, // <-- Return new state
    isButtonDisabled, // <-- Return new state
    handleToggleMode,
    handleToggleRecording,
    error,
    cleanup: stableCleanup,
  };
}; 