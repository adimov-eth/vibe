import * as recordingService from '@/services/recordingService';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useStore from '../state';
import type { StoreState } from '../state/types';
import { useUsage } from './useUsage';

interface RecordingState {
  // Recording configuration
  recordMode: 'separate' | 'live';
  currentPartner: 1 | 2;
  
  // Status flags
  isRecording: boolean;
  isProcessing: boolean;
  isPreparing: boolean;
  hasRecordingFinishedLastStep: boolean;
  
  // Error state
  error: string | null;
  
  // Recording data
  lastRecordingUri: string | null;
}

interface UseRecordingFlowProps {
  modeId: string;
}

interface RecordingFlowResult extends Omit<RecordingState, 'lastRecordingUri'> {
  localId: string;
  isButtonDisabled: boolean;
  handleToggleMode: (index: number) => void;
  handleToggleRecording: () => Promise<void>;
  cleanup: () => Promise<void>;
}

/**
 * Hook to manage the recording flow, including state transitions,
 * recording setup/teardown, and error handling
 */
export const useRecordingFlow = ({ modeId }: UseRecordingFlowProps): RecordingFlowResult => {
  // Generate stable ID for this recording session
  const [localId] = useState(Crypto.randomUUID());
  
  // Use a single state object to reduce re-renders
  const [state, setState] = useState<RecordingState>({
    recordMode: 'separate',
    currentPartner: 1,
    isRecording: false,
    isProcessing: false,
    isPreparing: false,
    hasRecordingFinishedLastStep: false,
    error: null,
    lastRecordingUri: null,
  });
  
  // Track operation status to prevent concurrent operations
  const operationInProgressRef = useRef(false);
  
  // Track component mount status to prevent state updates after unmount
  const mountedRef = useRef(true);
  
  // Check usage limits
  const { checkCanCreateConversation } = useUsage();
  
  // Access store for server ID mapping and actions
  const store = useStore();
  const serverId = useStore(useCallback(
    (state) => state.localToServerIds[localId], 
    [localId]
  ));
  
  const { saveUploadIntent, createConversation } = useStore(
    useShallow((state: StoreState) => ({
      saveUploadIntent: state.saveUploadIntent,
      createConversation: state.createConversation,
    }))
  );

  // Computed properties
  const isButtonDisabled = state.isProcessing || state.isPreparing;
  
  // Track mount status for cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => { 
      mountedRef.current = false;
    };
  }, []);

  // Setup audio recording on mount
  useEffect(() => {
    recordingService.setupAudioMode().catch(() => {
      if (mountedRef.current) {
        updateState({ error: 'Failed to initialize audio recording' });
      }
    });
    
    return () => {
      recordingService.cleanupAudioMode().catch(() => {
        // Non-critical cleanup error, safe to ignore
      });
    };
  }, []);

  // Helper to safely update state only if mounted
  const updateState = useCallback((newState: Partial<RecordingState>) => {
    if (mountedRef.current) {
      setState(prevState => ({ ...prevState, ...newState }));
    }
  }, []);

  /**
   * Prepare recording by checking permissions, usage limits, and creating conversation
   */
  const prepareRecording = useCallback(async (): Promise<boolean> => {
    if (!mountedRef.current) return false;
    
    try {
      // Check usage limits
      const canCreate = await checkCanCreateConversation();
      if (!canCreate) throw new Error('Usage limit reached or subscription required');
      
      // Check microphone permissions
      const hasPermission = await recordingService.checkPermissions();
      if (!hasPermission) throw new Error('Microphone permission denied');

      // Create conversation in store if needed
      const isFirstRecording = state.recordMode === 'live' || 
        (state.recordMode === 'separate' && state.currentPartner === 1);
        
      if (isFirstRecording && !serverId) {
        await createConversation(modeId, state.recordMode, localId);
      }

      return true;
    } catch (err) {
      if (mountedRef.current) {
        const errorMsg = `Failed to prepare recording: ${err instanceof Error ? err.message : String(err)}`;
        updateState({ 
          error: errorMsg,
          isPreparing: false 
        });
      }
      return false;
    }
  }, [
    checkCanCreateConversation, 
    createConversation, 
    localId, 
    modeId, 
    serverId, 
    state.currentPartner, 
    state.recordMode, 
    updateState
  ]);

  /**
   * Toggle between separate and live recording modes
   */
  const handleToggleMode = useCallback((index: number) => {
    if (isButtonDisabled) return;
    
    updateState({
      recordMode: index === 0 ? 'separate' : 'live',
      currentPartner: 1,
      error: null,
      isProcessing: false,
      isPreparing: false,
      hasRecordingFinishedLastStep: false,
    });
  }, [isButtonDisabled, updateState]);

  /**
   * Start or stop recording based on current state
   */
  const handleToggleRecording = useCallback(async () => {
    // Prevent concurrent operations
    if (operationInProgressRef.current) return;
    operationInProgressRef.current = true;

    try {
      updateState({ error: null });

      if (state.isRecording) {
        // Stop recording flow
        updateState({ 
          isProcessing: true,
          isRecording: false 
        });
        
        let uri: string | null = null;
        try {
          uri = await recordingService.stopRecording();
          if (!uri) throw new Error('Recording URI not found after stopping');
          
          // Handle unmount during recording
          if (!mountedRef.current) {
            if (uri) await recordingService.cleanupCurrentRecording(uri);
            return;
          }

          // Save recording info for upload
          updateState({ lastRecordingUri: uri });
          const audioKey = state.recordMode === 'live' ? 'live' : state.currentPartner.toString();
          await saveUploadIntent(localId, uri, audioKey);

          // Check if this was the final recording step
          const isLastRecordingStep = !(state.recordMode === 'separate' && state.currentPartner === 1);
          if (isLastRecordingStep) {
            updateState({ hasRecordingFinishedLastStep: true });
          } else {
            updateState({ 
              currentPartner: 2,
              isProcessing: false 
            });
          }
        } catch (err) {
          if (mountedRef.current) {
            const errorMsg = `Failed to stop recording: ${err instanceof Error ? err.message : String(err)}`;
            updateState({
              error: errorMsg,
              isProcessing: false,
              isRecording: false,
              hasRecordingFinishedLastStep: false,
            });
            
            await recordingService.cleanupCurrentRecording(uri || undefined);
            updateState({ lastRecordingUri: null });
          }
        }
      } else {
        // Start recording flow
        updateState({
          isPreparing: true,
          isProcessing: true,
          hasRecordingFinishedLastStep: false,
        });

        // Prepare recording environment
        const prepared = await prepareRecording();
        if (!prepared || !mountedRef.current) {
          updateState({
            isPreparing: false,
            isProcessing: false,
          });
          return;
        }

        // Small delay to ensure UI updates
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!mountedRef.current) {
          updateState({
            isPreparing: false,
            isProcessing: false,
          });
          return;
        }

        // Start actual recording
        try {
          await recordingService.startRecording();
          
          if (mountedRef.current) {
            updateState({
              isPreparing: false,
              isRecording: true,
              isProcessing: false,
            });
          } else {
            await recordingService.cleanupCurrentRecording();
          }
        } catch (recordingError) {
          if (mountedRef.current) {
            const errorMsg = `Failed to start recording: ${recordingError instanceof Error ? recordingError.message : String(recordingError)}`;
            updateState({
              error: errorMsg,
              isPreparing: false,
              isProcessing: false,
              isRecording: false,
            });
            await recordingService.cleanupCurrentRecording();
          }
        }
      }
    } finally {
      operationInProgressRef.current = false;
    }
  }, [
    localId, 
    prepareRecording, 
    saveUploadIntent, 
    state.currentPartner, 
    state.isRecording, 
    state.recordMode, 
    updateState
  ]);

  /**
   * Clean up all recording resources
   */
  const cleanup = useCallback(async () => {
    try {
      updateState({
        isRecording: false,
        isProcessing: false,
        isPreparing: false,
        error: null,
        currentPartner: 1,
        hasRecordingFinishedLastStep: false,
      });
      
      // Clean up recording resources if needed
      try {
        await recordingService.cleanupCurrentRecording(state.lastRecordingUri || undefined);
      } catch {
        // Non-critical cleanup error, safe to ignore
      }
      
      updateState({ lastRecordingUri: null });
    } catch {
      // Catch any unexpected errors in cleanup
    }
  }, [state.lastRecordingUri, updateState]);

  // Automatic cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup().catch(() => {
        // Non-critical cleanup error on unmount, safe to ignore
      });
    };
  // Only run on unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Return stable interface
  return {
    localId,
    recordMode: state.recordMode,
    currentPartner: state.currentPartner,
    isRecording: state.isRecording,
    isProcessing: state.isProcessing,
    isPreparing: state.isPreparing,
    error: state.error,
    isButtonDisabled,
    hasRecordingFinishedLastStep: state.hasRecordingFinishedLastStep,
    handleToggleMode,
    handleToggleRecording,
    cleanup,
  };
};