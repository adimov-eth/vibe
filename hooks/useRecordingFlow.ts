import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import useStore from "../state/index";
import { useUsage } from "./useUsage";
// Import the actual service
import * as recordingService from '@/services/recordingService';

interface UseRecordingFlowProps {
  modeId: string;
}

interface RecordingFlowResult {
  localId: string;
  recordMode: 'separate' | 'live';
  currentPartner: 1 | 2;
  isRecording: boolean;
  isProcessing: boolean; // Simplified: Covers local processing & waiting for server ID
  error: string | null;
  isButtonDisabled: boolean;
  handleToggleMode: (index: number) => void;
  handleToggleRecording: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export const useRecordingFlow = ({ modeId }: UseRecordingFlowProps): RecordingFlowResult => {
  const [localId] = useState(Crypto.randomUUID());
  const [recordMode, setRecordMode] = useState<'separate' | 'live'>('separate');
  const [currentPartner, setCurrentPartner] = useState<1 | 2>(1);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // Single processing flag
  const [error, setError] = useState<string | null>(null);
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);

  const { checkCanCreateConversation } = useUsage();
  const store = useStore();
  const serverId = useStore(useCallback(state => state.localToServerIds[localId], [localId]));

  // Derived state for button disable
  const isButtonDisabled = isRecording || isProcessing;
  
  // Ref to track mounted state for async operations
  const mountedRef = useRef(true);
  useEffect(() => {
      mountedRef.current = true;
      return () => { mountedRef.current = false; };
  }, []);

  // Setup/Cleanup Audio Mode
  useEffect(() => {
    recordingService.setupAudioMode().catch(err => {
      console.error('[useRecordingFlow] Failed to set audio mode:', err);
      if(mountedRef.current) setError('Failed to initialize audio recording');
    });
    return () => {
      recordingService.cleanupAudioMode().catch(console.error);
    };
  }, []);

  // Core Cleanup Function
  const cleanup = useCallback(async () => {
    console.log("[useRecordingFlow] cleanup: Starting cleanup.");
    setIsRecording(false);
    setIsProcessing(false);
    setError(null);
    setCurrentPartner(1);
    // Cleanup recording resources and potentially the last saved file URI
    await recordingService.cleanupCurrentRecording(lastRecordingUri || undefined);
    setLastRecordingUri(null);
    console.log("[useRecordingFlow] cleanup: Finished cleanup.");
  }, [lastRecordingUri]); // Dependency on lastRecordingUri to ensure correct file cleanup

  // Toggle Recording Mode
  const handleToggleMode = useCallback((index: number) => {
    if (isButtonDisabled) return;
    setRecordMode(index === 0 ? 'separate' : 'live');
    setCurrentPartner(1);
    setError(null);
    setIsProcessing(false); // Ensure processing state is reset
  }, [isButtonDisabled]);

  // Start/Stop Recording Logic
  const handleToggleRecording = useCallback(async () => {
    if (isButtonDisabled) return;

    setError(null);

    if (isRecording) {
      // --- Stop Recording ---
      console.log("[useRecordingFlow] Stopping recording...");
      setIsProcessing(true); // Indicate processing starts
      setIsRecording(false); // Optimistic UI update
      let uri: string | null = null;
      try {
        uri = await recordingService.stopRecording();
        if (!uri) throw new Error('Recording URI not found');
        setLastRecordingUri(uri); // Store URI for potential cleanup

        console.log(`[useRecordingFlow] Recording stopped. URI: ${uri}`);
        const audioKey = recordMode === 'live' ? 'live' : currentPartner.toString();
        
        // Save intent immediately (store handles serverId mapping)
        await store.saveUploadIntent(localId, uri, audioKey);
        console.log(`[useRecordingFlow] Saved upload intent for localId ${localId}, audioKey ${audioKey}`);

        const isLastRecordingStep = !(recordMode === 'separate' && currentPartner === 1);

        if (isLastRecordingStep) {
           console.log('[useRecordingFlow] Last recording step finished.');
           // Processing remains true until navigation happens (triggered by serverId update)
        } else {
          setCurrentPartner(2);
          setIsProcessing(false); // Ready for next recording
          console.log('[useRecordingFlow] Separate mode: Switched to Partner 2.');
        }
      } catch (err) {
        console.error('[useRecordingFlow] Error stopping recording:', err);
        if (mountedRef.current) {
            setError(`Failed to stop recording: ${err instanceof Error ? err.message : String(err)}`);
            setIsProcessing(false);
            setIsRecording(false); // Ensure recording state is false
            // Attempt cleanup, potentially deleting the failed recording URI if it exists
            await recordingService.cleanupCurrentRecording(uri || undefined);
            setLastRecordingUri(null);
        }
      }
    } else {
      // --- Start Recording ---
      console.log("[useRecordingFlow] Starting recording...");
      setIsProcessing(true); // Disable button while preparing
      try {
        // 1. Check Usage
        const canCreate = await checkCanCreateConversation();
        if (!canCreate) throw new Error('Usage limit reached or subscription required');

        // 2. Check Permissions (handled by service)
        const hasPermission = await recordingService.checkPermissions();
        if (!hasPermission) throw new Error('Microphone permission denied');

        // 3. Create Conversation (only if first recording attempt)
        const isFirstRecording = recordMode === 'live' || (recordMode === 'separate' && currentPartner === 1);
        if (isFirstRecording && !serverId) { // Check if serverId isn't already mapped
           console.log(`[useRecordingFlow] First recording. Creating conversation with localId: ${localId}`);
           await store.createConversation(modeId, recordMode, localId);
           console.log(`[useRecordingFlow] Conversation creation initiated for localId: ${localId}.`);
        }

        // 4. Start Recording (handled by service)
        await recordingService.startRecording();
        if (mountedRef.current) {
            setIsRecording(true);
            console.log('[useRecordingFlow] Recording started successfully.');
        }
      } catch (err) {
        console.error('[useRecordingFlow] Error starting recording:', err);
        if (mountedRef.current) {
            setError(`Failed to start recording: ${err instanceof Error ? err.message : String(err)}`);
            // Ensure cleanup happens on start error
            await recordingService.cleanupCurrentRecording(); 
        }
      } finally {
        if (mountedRef.current) {
            setIsProcessing(false); // Re-enable button regardless of success/failure
        }
      }
    }
  // Dependencies include state needed for logic and store actions/selectors
  }, [isRecording, isButtonDisabled, recordMode, currentPartner, localId, modeId, serverId, store, checkCanCreateConversation]);

  // Unmount cleanup
  useEffect(() => {    
    return () => {
      console.log("[useRecordingFlow] Unmount effect: Calling cleanup.");
      cleanup().catch(err => console.error("[useRecordingFlow] Error during unmount cleanup:", err));
    };
  }, [cleanup]);

  return {
    localId,
    recordMode,
    currentPartner,
    isRecording,
    isProcessing, // Use the simplified flag
    error,
    isButtonDisabled,
    handleToggleMode,
    handleToggleRecording,
    cleanup,
  };
};

// Helper to get latest state if needed outside of setters
// This helper might not be necessary anymore if refs handle most cases
// function get() {
//     return useStore.getState();
// } 