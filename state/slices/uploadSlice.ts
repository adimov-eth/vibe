import { getPendingUploads, savePendingUpload } from '@/utils/background-upload';
import { uploadFile } from '@/utils/upload-helpers';
import { StateCreator } from 'zustand';
import { PendingUpload, StoreState, UploadResult } from '../types';

interface UploadSlice {
  uploadProgress: { [uploadId: string]: number };
  uploadResults: { [uploadId: string]: UploadResult };
  pendingUploads: PendingUpload[];
  localToServerIds: { [localConversationId: string]: string };
  uploadAudio: (audioUri: string, conversationId: string, audioKey: string, localConversationId?: string) => Promise<void>;
  addPendingUpload: (localConversationId: string, audioUri: string, audioKey: string) => void;
  processPendingUploads: (localConversationId: string) => void;
  setLocalToServerId: (localId: string, serverId: string) => void;
  clearUploadState: (conversationId: string) => void;
  retryUpload: (uploadId: string) => void;
  initializeBackgroundUpload: () => Promise<void>; // New initializer
}

export const createUploadSlice: StateCreator<StoreState, [], [], UploadSlice> = (
  set,
  get
) => ({
  uploadProgress: {},
  uploadResults: {},
  pendingUploads: [],
  localToServerIds: {},

  initializeBackgroundUpload: async () => {
    try {
      // Load any pending uploads from AsyncStorage
      const pendingUploads = await getPendingUploads();
      
      // Update local state with pending uploads
      set((state) => ({
        pendingUploads: [
          ...state.pendingUploads,
          ...pendingUploads.map(upload => ({
            localConversationId: upload.conversationId, // Use as local ID for now
            audioUri: upload.audioUri,
            audioKey: upload.audioKey,
          })),
        ],
      }));
    } catch (error) {
      console.error('Failed to initialize background upload state:', error);
    }
  },

  setLocalToServerId: (localId: string, serverId: string) => {
    set((state) => ({
      localToServerIds: { ...state.localToServerIds, [localId]: serverId },
    }));
    get().processPendingUploads(localId); // Process pending uploads for this ID
  },

  addPendingUpload: async (localConversationId: string, audioUri: string, audioKey: string) => {
    // Save to AsyncStorage first
    await savePendingUpload({ 
      audioUri, 
      conversationId: localConversationId, // Use local ID until we have server ID
      audioKey 
    });
    
    // Then update local state
    set((state) => ({
      pendingUploads: [
        ...state.pendingUploads,
        { localConversationId, audioUri, audioKey },
      ],
    }));
  },

  processPendingUploads: async (localConversationId: string) => {
    const state = get();
    const serverId = state.localToServerIds[localConversationId];
    if (!serverId) return;

    const pendingForConversation = state.pendingUploads.filter(
      (upload) => upload.localConversationId === localConversationId
    );

    for (const upload of pendingForConversation) {
      await state.uploadAudio(upload.audioUri, serverId, upload.audioKey, localConversationId);
    }

    // Remove processed uploads from local state
    set((state) => ({
      pendingUploads: state.pendingUploads.filter(
        (upload) => upload.localConversationId !== localConversationId
      ),
    }));
  },

  uploadAudio: async (audioUri: string, conversationId: string, audioKey: string, localConversationId?: string) => {
    const uploadId = `${conversationId}_${audioKey}`;

    try {
      // Start upload and track progress
      const result = await uploadFile({
        audioUri,
        conversationId,
        audioKey,
        onProgress: (progress) => {
          set((state) => ({
            uploadProgress: { ...state.uploadProgress, [uploadId]: progress },
          }));
        },
      });

      // Update upload result
      set((state) => ({
        uploadResults: {
          ...state.uploadResults,
          [uploadId]: {
            ...result,
            audioUri,
            conversationId,
            audioKey,
            localConversationId,
          },
        },
      }));

      if (!result.success) {
        // If upload failed, save to AsyncStorage for background retry
        await savePendingUpload({ audioUri, conversationId, audioKey });
        
        // Also update local state
        set((state) => ({
          pendingUploads: [
            ...state.pendingUploads,
            { localConversationId: localConversationId || conversationId, audioUri, audioKey },
          ],
        }));
      }

    } catch (error) {
      console.error(`Upload failed for ${uploadId}:`, error);
      // Save failed upload for background retry
      await savePendingUpload({ audioUri, conversationId, audioKey });
      
      set((state) => ({
        uploadResults: {
          ...state.uploadResults,
          [uploadId]: {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            audioUri,
            conversationId,
            audioKey,
            localConversationId,
          },
        },
        pendingUploads: [
          ...state.pendingUploads,
          { localConversationId: localConversationId || conversationId, audioUri, audioKey },
        ],
      }));
    }
  },

  clearUploadState: (conversationId: string) => {
    set((state) => {
      const newProgress = { ...state.uploadProgress };
      const newResults = { ...state.uploadResults };
      const uploadIds = Object.keys(newProgress).filter((id) =>
        id.startsWith(`${conversationId}_`)
      );
      uploadIds.forEach((id) => {
        delete newProgress[id];
        delete newResults[id];
      });
      return {
        uploadProgress: newProgress,
        uploadResults: newResults,
        pendingUploads: state.pendingUploads.filter(
          (upload) =>
            upload.localConversationId !== conversationId &&
            !state.localToServerIds[conversationId]?.includes(upload.localConversationId)
        ),
      };
    });
  },

  retryUpload: async (uploadId: string) => {
    const state = get();
    const failedUpload = state.uploadResults[uploadId];
    if (!failedUpload || !failedUpload.audioUri) return;

    await state.uploadAudio(
      failedUpload.audioUri,
      failedUpload.conversationId!,
      failedUpload.audioKey!,
      failedUpload.localConversationId
    );
  },
});