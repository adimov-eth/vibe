import { getPendingUploads, removePendingUpload, savePendingUpload } from '@/utils/background-upload';
import { uploadFile } from '@/utils/upload-helpers';
import * as FileSystem from 'expo-file-system';
import { StateCreator } from 'zustand';
import { PendingUpload, StoreState, UploadSlice } from '../types';

export const createUploadSlice: StateCreator<StoreState, [], [], UploadSlice> = (
  set,
  get
) => ({
  uploadProgress: {},
  uploadResults: {},
  pendingUploads: [],
  localToServerIds: {},

  initializeUploads: async () => {
    console.log('[UploadSlice:initializeUploads] Initializing uploads...');
    try {
      const persistedPendingUploads = await getPendingUploads();
      console.log(`[UploadSlice:initializeUploads] Found ${persistedPendingUploads.length} persisted pending uploads from AsyncStorage.`);

      if (persistedPendingUploads.length > 0) {
         console.log('[UploadSlice:initializeUploads] Attempting to process persisted pending uploads via foreground method...');
         for (const upload of persistedPendingUploads) {
            // Attempt to derive uploadId. Need serverId if possible.
            // If conversationId in persisted data is localId, we might need to wait for mapping.
            // This logic assumes conversationId stored by background task IS the serverId.
             const uploadId = `${upload.conversationId}_${upload.audioKey}`;
             const existingResult = get().uploadResults[uploadId];
             console.log(`[UploadSlice:initializeUploads] Processing persisted upload: ID=${uploadId}, ConvID=${upload.conversationId}, Key=${upload.audioKey}, URI=${upload.audioUri}`);

             if (!existingResult || !existingResult.success) {
                 console.log(`[UploadSlice:initializeUploads] Retrying persisted upload: ${uploadId}`);
                 await get().uploadAudio(
                     upload.audioUri,
                     upload.conversationId,
                     upload.audioKey,
                     undefined, // LocalId might not be known here
                     true // Indicate this is a retry
                 );
             } else {
                 console.log(`[UploadSlice:initializeUploads] Skipping retry for already successful persisted upload: ${uploadId}`);
                 await removePendingUpload(upload.conversationId, upload.audioKey);
             }
         }
      }
    } catch (error) {
      console.error('[UploadSlice:initializeUploads] Failed to initialize/process persisted uploads:', error);
    }
  },

  setLocalToServerId: (localId: string, serverId: string) => {
    console.log(`[UploadSlice:setLocalToServerId] Mapping localId ${localId} to serverId ${serverId}`);
    const previouslyUnmapped = !get().localToServerIds[localId];
    set((state) => ({
      localToServerIds: { ...state.localToServerIds, [localId]: serverId },
    }));
    if (previouslyUnmapped) {
        console.log(`[UploadSlice:setLocalToServerId] First time serverId received for ${localId}. Triggering processPendingUploads.`);
        get().processPendingUploads(localId);
    } else {
        console.log(`[UploadSlice:setLocalToServerId] ServerId for ${localId} was already known. No action needed.`);
    }
  },

  addPendingUpload: async (localConversationId: string, audioUri: string, audioKey: string) => {
    console.log(`[UploadSlice:addPendingUpload] Called for localId: ${localConversationId}, key: ${audioKey}`);
    const newPending: PendingUpload = { localConversationId, audioUri, audioKey };
    set((state) => ({
      pendingUploads: [...state.pendingUploads, newPending],
    }));
    console.log(`[UploadSlice:addPendingUpload] Added to in-memory pendingUploads state. Current count: ${get().pendingUploads.length}`);

    const serverId = get().localToServerIds[localConversationId];
    if (serverId) {
       console.log(`[UploadSlice:addPendingUpload] ServerId ${serverId} known for ${localConversationId}. Attempting immediate foreground upload via uploadAudio.`);
       await get().uploadAudio(audioUri, serverId, audioKey, localConversationId);
    } else {
        console.log(`[UploadSlice:addPendingUpload] ServerId not yet known for ${localConversationId}. Saving to AsyncStorage for later processing/background task.`);
        await savePendingUpload({
           audioUri,
           conversationId: localConversationId,
           audioKey
        });
         console.log(`[UploadSlice:addPendingUpload] Saved to AsyncStorage with LOCAL ID: ${localConversationId}, Key: ${audioKey}`);
    }
  },

  processPendingUploads: async (localConversationId: string) => {
    const state = get();
    const serverId = state.localToServerIds[localConversationId];
    console.log(`[UploadSlice:processPendingUploads] Attempting for localId ${localConversationId}`);
    if (!serverId) {
        console.warn(`[UploadSlice:processPendingUploads] ServerId still not found for ${localConversationId}. Cannot process.`);
        return;
    }
    console.log(`[UploadSlice:processPendingUploads] Processing session uploads for localId ${localConversationId} (mapped to serverId: ${serverId})`);

    const pendingForConversation = state.pendingUploads.filter(
      (upload) => upload.localConversationId === localConversationId
    );
    console.log(`[UploadSlice:processPendingUploads] Found ${pendingForConversation.length} in-memory uploads for ${localConversationId}.`);

    if (pendingForConversation.length === 0) {
        console.log(`[UploadSlice:processPendingUploads] No in-memory uploads found for ${localConversationId}, nothing to process immediately.`);
        return;
    }

    for (const upload of pendingForConversation) {
       console.log(`[UploadSlice:processPendingUploads] Triggering foreground upload (via uploadAudio) for session pending item: key ${upload.audioKey} for serverId ${serverId}`);
      await state.uploadAudio(upload.audioUri, serverId, upload.audioKey, localConversationId);
    }

    set((state) => ({
      pendingUploads: state.pendingUploads.filter(
        (upload) => upload.localConversationId !== localConversationId
      ),
    }));
     console.log(`[UploadSlice:processPendingUploads] Cleared processed in-memory pending uploads for ${localConversationId}. Remaining count: ${get().pendingUploads.length}`);
  },

  uploadAudio: async (
      audioUri: string,
      conversationId: string,
      audioKey: string,
      localConversationId?: string,
      isPersistedRetry: boolean = false
  ) => {
    const uploadId = `${conversationId}_${audioKey}`;
    console.log(`[UploadSlice:uploadAudio] STARTING UploadId=${uploadId}, ServerConvId=${conversationId}, LocalConvId=${localConversationId || 'N/A'}, Key=${audioKey}, IsPersistedRetry=${isPersistedRetry}, URI=${audioUri}`);

    try {
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
          console.error(`[UploadSlice:uploadAudio] File does not exist, cannot upload: ${audioUri}`);
          set((state) => ({
            uploadResults: {
              ...state.uploadResults,
              [uploadId]: { success: false, error: 'Local file missing', audioUri, conversationId, audioKey, localConversationId },
            },
            uploadProgress: { ...state.uploadProgress, [uploadId]: -1 },
          }));
          await removePendingUpload(conversationId, audioKey);
          return;
      }
    } catch (infoError) {
        console.error(`[UploadSlice:uploadAudio] Error checking file existence for ${audioUri}:`, infoError);
    }

    try {
      set((state) => ({
         uploadProgress: { ...state.uploadProgress, [uploadId]: 0 },
         uploadResults: { ...state.uploadResults, [uploadId]: { success: false, error: undefined } }
      }));

      console.log(`[UploadSlice:uploadAudio] Calling uploadFile helper for ${uploadId}`);
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

      console.log(`[UploadSlice:uploadAudio] UploadFile helper finished for ${uploadId}. Success: ${result.success}, Status Code: ${result.statusCode}, Error: ${result.error}`);

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
         uploadProgress: { ...state.uploadProgress, [uploadId]: result.success ? 100 : -1 },
      }));

      if (!result.success) {
        console.error(`[UploadSlice:uploadAudio] Foreground upload FAILED for ${uploadId}: ${result.error}`);
        if (!isPersistedRetry) {
             console.log(`[UploadSlice:uploadAudio] Saving failed foreground upload ${uploadId} to AsyncStorage for background retry.`);
             await savePendingUpload({ audioUri, conversationId, audioKey });
             console.log(`[UploadSlice:uploadAudio] Saved to AsyncStorage with SERVER ID: ${conversationId}, Key: ${audioKey}`);
        } else {
            console.warn(`[UploadSlice:uploadAudio] Persisted retry failed for ${uploadId}. It will remain in AsyncStorage for the background task.`);
        }
      } else {
         console.log(`[UploadSlice:uploadAudio] Foreground upload SUCCESSFUL for ${uploadId}.`);
         await removePendingUpload(conversationId, audioKey);
         try {
            console.log(`[UploadSlice:uploadAudio] Deleting local file ${audioUri} after successful foreground upload.`);
            await FileSystem.deleteAsync(audioUri, { idempotent: true });
            console.log(`[UploadSlice:uploadAudio] Deleted local file ${audioUri}.`);
         } catch (deleteError) {
             console.error(`[UploadSlice:uploadAudio] Failed to delete local file ${audioUri} after successful foreground upload: ${deleteError}`);
         }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[UploadSlice:uploadAudio] UNCAUGHT error during foreground upload for ${uploadId}:`, errorMessage);
      set((state) => ({
        uploadResults: {
          ...state.uploadResults,
          [uploadId]: {
            success: false,
            error: `Uncaught: ${errorMessage}`,
            audioUri,
            conversationId,
            audioKey,
            localConversationId,
          },
        },
         uploadProgress: { ...state.uploadProgress, [uploadId]: -1 },
      }));
      if (!isPersistedRetry) {
         console.log(`[UploadSlice:uploadAudio] Saving failed foreground upload ${uploadId} (due to uncaught error) to AsyncStorage for background retry.`);
         await savePendingUpload({ audioUri, conversationId, audioKey });
         console.log(`[UploadSlice:uploadAudio] Saved to AsyncStorage with SERVER ID: ${conversationId}, Key: ${audioKey}`);
      } else {
           console.warn(`[UploadSlice:uploadAudio] Persisted retry failed (due to uncaught error) for ${uploadId}. It will remain in AsyncStorage for the background task.`);
      }
    }
  },

  clearUploadState: (conversationId: string) => {
    console.log(`[UploadSlice] clearUploadState called for ID: ${conversationId}`);
    set((state) => {
      const serverId = state.localToServerIds[conversationId] || conversationId;
      const newProgress = { ...state.uploadProgress };
      const newResults = { ...state.uploadResults };
      const uploadIds = Object.keys(newResults).filter((id) =>
        id.startsWith(`${serverId}_`)
      );

      if (uploadIds.length > 0) {
          console.log(`[UploadSlice] Clearing state for ${uploadIds.length} uploads related to serverId ${serverId}`);
          uploadIds.forEach((id) => {
            delete newProgress[id];
            delete newResults[id];
          });
      }

      return {
        uploadProgress: newProgress,
        uploadResults: newResults,
      };
    });
  },

  retryUpload: async (uploadId: string) => {
    console.log(`[UploadSlice:retryUpload] Manual retry requested for: ${uploadId}`);
    const state = get();
    const failedUpload = state.uploadResults[uploadId];
    if (!failedUpload || !failedUpload.audioUri || !failedUpload.conversationId || !failedUpload.audioKey) {
        console.warn(`[UploadSlice:retryUpload] Cannot retry upload ${uploadId}: Missing required data (audioUri, conversationId, audioKey) in stored result. Result data:`, failedUpload);
        return;
    }

    console.log(`[UploadSlice:retryUpload] Retrying upload ${uploadId} via foreground uploadAudio.`);
    await state.uploadAudio(
      failedUpload.audioUri,
      failedUpload.conversationId,
      failedUpload.audioKey,
      failedUpload.localConversationId,
      true
    );
  },
});