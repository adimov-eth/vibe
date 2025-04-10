import * as recordingService from '@/services/recordingService';
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from 'zustand/react/shallow';
import useStore from "../state/index";
import type { StoreState } from '../state/types';
import { useUsage } from "./useUsage";

interface UseRecordingFlowProps {
  modeId: string;
}

interface RecordingFlowResult {
  localId: string;
  recordMode: 'separate' | 'live';
  currentPartner: 1 | 2;
  isRecording: boolean;
  isProcessing: boolean
  error: string | null;
  isButtonDisabled: boolean;
  hasRecordingFinishedLastStep: boolean;
  handleToggleMode: (index: number) => void;
  handleToggleRecording: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export const useRecordingFlow = ({ modeId }: UseRecordingFlowProps): RecordingFlowResult => {
  const [localId] = useState(Crypto.randomUUID());
  const [recordMode, setRecordMode] = useState<'separate' | 'live'>('separate');
  const [currentPartner, setCurrentPartner] = useState<1 | 2>(1);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);
  const [hasRecordingFinishedLastStep, setHasRecordingFinishedLastStep] = useState(false);

  const operationInProgressRef = useRef(false);
  const { checkCanCreateConversation } = useUsage();
  const store = useStore();
  const serverId = useStore(useCallback(state => state.localToServerIds[localId], [localId]));

  const isButtonDisabled = isRecording || isProcessing;
  
  const mountedRef = useRef(true);
  useEffect(() => {
      mountedRef.current = true;
      return () => { mountedRef.current = false; };
  }, []);

  const { saveUploadIntent, createConversation } = useStore(
      useShallow((state: StoreState) => ({
         saveUploadIntent: state.saveUploadIntent,
         createConversation: state.createConversation,
      }))
  );

  useEffect(() => {
    recordingService.setupAudioMode().catch(err => {
        if(mountedRef.current) setError('Failed to initialize audio recording');
    });
    return () => {
      recordingService.cleanupAudioMode().catch(console.error);
    };
  }, []);

  const cleanup = useCallback(async () => {
      setIsRecording(false);
      setIsProcessing(false);
      setError(null);
      setCurrentPartner(1);
      setHasRecordingFinishedLastStep(false);
      await recordingService.cleanupCurrentRecording(lastRecordingUri || undefined);
      setLastRecordingUri(null);
  }, [lastRecordingUri]);

  const handleToggleMode = useCallback((index: number) => {
    if (isButtonDisabled) return;
    setRecordMode(index === 0 ? 'separate' : 'live');
    setCurrentPartner(1);
    setError(null);
    setIsProcessing(false);
    setHasRecordingFinishedLastStep(false);
  }, [isButtonDisabled]);

  const handleToggleRecording = useCallback(async () => {
      if (operationInProgressRef.current) {
          return;
      }
      operationInProgressRef.current = true;
      try {
          setError(null);

          if (isRecording) {
              setIsProcessing(true);
              setIsRecording(false);
              let uri: string | null = null;
              try {
                  uri = await recordingService.stopRecording();

                  if (!uri) {
                      throw new Error('Recording URI not found after stopping');
                  }

                  if (!mountedRef.current) {
                      if(uri) await recordingService.cleanupCurrentRecording(uri);
                      return;
                  }

                  setLastRecordingUri(uri);

                  const audioKey = recordMode === 'live' ? 'live' : currentPartner.toString();
                  await saveUploadIntent(localId, uri, audioKey);

                  const isLastRecordingStep = !(recordMode === 'separate' && currentPartner === 1);

                  if (isLastRecordingStep) {
                      setHasRecordingFinishedLastStep(true);
                  } else {
                      setCurrentPartner(2);
                      setIsProcessing(false);
                  }
              } catch (err) {
                  if (mountedRef.current) {
                      const errorMsg = `Failed to stop recording: ${err instanceof Error ? err.message : String(err)}`;
                      setError(errorMsg);
                      setIsProcessing(false);
                      setIsRecording(false);
                      setHasRecordingFinishedLastStep(false);

                      await recordingService.cleanupCurrentRecording(uri || undefined);
                      setLastRecordingUri(null);
                  }
              }
          } else {
              setIsProcessing(true);
              setHasRecordingFinishedLastStep(false);
              try {
                  const canCreate = await checkCanCreateConversation();
                  if (!canCreate) throw new Error('Usage limit reached or subscription required');
                  const hasPermission = await recordingService.checkPermissions();
                  if (!hasPermission) throw new Error('Microphone permission denied');

                  const isFirstRecording = recordMode === 'live' || (recordMode === 'separate' && currentPartner === 1);
                  if (isFirstRecording && !serverId) {
                      createConversation(modeId, recordMode, localId).catch(err => {});
                  }

                  if (mountedRef.current) {
                      setIsRecording(true);
                  } else {
                      throw new Error("Component unmounted");
                  }

                  await recordingService.startRecording();
                  if (mountedRef.current) {
                      setIsProcessing(false);
                  } else {
                      await recordingService.cleanupCurrentRecording();
                  }
              } catch (err) {
                  if (mountedRef.current) {
                      const errorMsg = `Failed to start recording: ${err instanceof Error ? err.message : String(err)}`;
                      setError(errorMsg);
                      setIsProcessing(false);
                      setIsRecording(false);
                      await recordingService.cleanupCurrentRecording();
                  }
              }
          }
      } finally {
          operationInProgressRef.current = false;
      }
  }, [isRecording, isProcessing, recordMode, currentPartner, localId, modeId, serverId, checkCanCreateConversation, saveUploadIntent, createConversation]);

  useEffect(() => {    
    return () => {
        cleanup().catch(err => {});
    };
  }, [cleanup]);

  return {
    localId,
    recordMode,
    currentPartner,
    isRecording,
    isProcessing,
    error,
    isButtonDisabled,
    hasRecordingFinishedLastStep,
    handleToggleMode,
    handleToggleRecording,
    cleanup,
  };
};