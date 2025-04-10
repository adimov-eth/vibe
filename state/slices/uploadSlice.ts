import {
  getPendingUploads,
  removePendingUpload,
  saveOrUpdatePendingUpload,
  setStoredIdMap
} from '@/utils/background-upload';
import { uploadFile } from '@/utils/upload-helpers';
import * as FileSystem from 'expo-file-system';
import { StateCreator } from 'zustand';
import { StoreState, UploadSlice } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const createUploadSlice: StateCreator<StoreState, [], [], UploadSlice> = (
  set,
  get
) => ({
  uploadProgress: {},
  uploadResults: {},
  localToServerIds: {},

  initializeUploads: async () => {
      try {
          const persistedPendingUploads = await getPendingUploads();
          const currentLocalToServerIds = get().localToServerIds;

          if (persistedPendingUploads.length > 0) {
              for (const upload of persistedPendingUploads) {
                  let serverIdToUse: string | undefined = undefined;
                  const localId: string | undefined = upload.localConversationId || (UUID_REGEX.test(upload.conversationId) ? undefined : upload.conversationId);

                  if (UUID_REGEX.test(upload.conversationId)) {
                      serverIdToUse = upload.conversationId;
                  } else if (localId) {
                      serverIdToUse = currentLocalToServerIds[localId];
                  }

                  const uploadId = `${serverIdToUse || localId || 'unknown'}_${upload.audioKey}`;
                  const existingResult = get().uploadResults[uploadId];

                  if (!serverIdToUse) {
                      continue;
                  }

                  const currentProgress = get().uploadProgress[uploadId];
                  if (existingResult?.success || (currentProgress !== undefined && currentProgress >= 0)) {
                      if (existingResult?.success) {
                           await removePendingUpload(serverIdToUse, upload.audioKey, currentLocalToServerIds);
                      }
                      continue;
                  }

                  await get().uploadAudio(
                      upload.audioUri,
                      serverIdToUse, upload.audioKey,
                      localId, true
                  );
              }
          }
      } catch (error) {}
  },

  setLocalToServerId: async (localId: string, serverId: string) => {
      const currentMap = get().localToServerIds;
      const previouslyUnmapped = !currentMap[localId];
      const updatedMap = { ...currentMap, [localId]: serverId };

      set({ localToServerIds: updatedMap });

      try {
          await setStoredIdMap(updatedMap);
      } catch (e) {}

      if (previouslyUnmapped) {
          try {
              const persistedUploads = await getPendingUploads();
              const uploadsForLocalId = persistedUploads.filter(
                  upload => upload.conversationId === localId
              );

              for (const upload of uploadsForLocalId) {
                  await saveOrUpdatePendingUpload({
                      ...upload,
                      conversationId: serverId,
                      localConversationId: localId,
                  });
                  const uploadId = `${serverId}_${upload.audioKey}`;
                  const existingResult = get().uploadResults[uploadId];
                  const currentProgress = get().uploadProgress[uploadId];
                  if (existingResult?.success || (currentProgress !== undefined && currentProgress >= 0)) {
                      if (existingResult?.success) {
                           await removePendingUpload(serverId, upload.audioKey, updatedMap);
                      }
                      continue;
                  }

                  await get().uploadAudio(
                      upload.audioUri,
                      serverId,
                      upload.audioKey,
                      localId, true
                  );
              }
          } catch (error) {}
      } else
          {}
  },

  saveUploadIntent: async (localConversationId: string, audioUri: string, audioKey: string) => {
      const currentLocalToServerIds = get().localToServerIds;
      const serverId = currentLocalToServerIds[localConversationId];

      await saveOrUpdatePendingUpload({
         conversationId: serverId || localConversationId,
         localConversationId: localConversationId,
         audioUri,
         audioKey
      });
      if (serverId) {
          const uploadId = `${serverId}_${audioKey}`;
          const existingResult = get().uploadResults[uploadId];
          const currentProgress = get().uploadProgress[uploadId];

          if (existingResult?.success || (currentProgress !== undefined && currentProgress >= 0)) {
              if (existingResult?.success) {
                  await removePendingUpload(serverId, audioKey, currentLocalToServerIds);
              }
          } else {
              await get().uploadAudio(audioUri, serverId, audioKey, localConversationId);
          }
      } else
          {}
  },

  uploadAudio: async (
      audioUri: string,
      conversationId: string,
      audioKey: string,
      localConversationId?: string,
      isPersistedRetry: boolean = false
  ) => {
      if (!UUID_REGEX.test(conversationId)) {
          const tempUploadId = `${localConversationId || conversationId}_${audioKey}`;
          set((state) => ({
             uploadResults: { ...state.uploadResults, [tempUploadId]: { success: false, error: 'Internal Error: Invalid Server ID for upload', audioUri, conversationId, audioKey, localConversationId } },
             uploadProgress: { ...state.uploadProgress, [tempUploadId]: -1 },
          }));
          return;
      }

      const uploadId = `${conversationId}_${audioKey}`;
      const currentLocalToServerIds = get().localToServerIds;
      try {
        const fileInfo = await FileSystem.getInfoAsync(audioUri);
        if (!fileInfo.exists) {
            set((state) => ({
              uploadResults: { ...state.uploadResults, [uploadId]: { success: false, error: 'Local file missing', audioUri, conversationId, audioKey, localConversationId } },
              uploadProgress: { ...state.uploadProgress, [uploadId]: -1 },
            }));
            await removePendingUpload(conversationId, audioKey, currentLocalToServerIds);
            return;
        }
      } catch (infoError) {
          const errorMessage = infoError instanceof Error ? infoError.message : String(infoError);
          set((state) => ({
              uploadResults: { ...state.uploadResults, [uploadId]: { success: false, error: `File check error: ${errorMessage}`, audioUri, conversationId, audioKey, localConversationId } },
              uploadProgress: { ...state.uploadProgress, [uploadId]: -1 },
          }));
          return;
      }

      try {
          set((state) => ({
             uploadProgress: { ...state.uploadProgress, [uploadId]: 0 },
             uploadResults: { ...state.uploadResults, [uploadId]: { success: false, error: undefined, audioUri, conversationId, audioKey, localConversationId } }
          }));

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

          set((state) => ({
            uploadResults: {
              ...state.uploadResults,
              [uploadId]: { ...result, audioUri, conversationId, audioKey, localConversationId },
            },
             uploadProgress: { ...state.uploadProgress, [uploadId]: result.success ? 100 : -1 },
          }));

          if (result.success) {
              await removePendingUpload(conversationId, audioKey, currentLocalToServerIds);

              try {
                  await FileSystem.deleteAsync(audioUri, { idempotent: true });
              } catch (deleteError) {}
          } else {}
      } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          set((state) => ({
            uploadResults: {
              ...state.uploadResults,
              [uploadId]: { success: false, error: `Uncaught: ${errorMessage}`, audioUri, conversationId, audioKey, localConversationId },
            },
             uploadProgress: { ...state.uploadProgress, [uploadId]: -1 },
          }));
      }
  },

  clearUploadState: (conversationId: string) => {
      set((state) => {
        const serverId = state.localToServerIds[conversationId] || conversationId;
        const newProgress = { ...state.uploadProgress };
        const newResults = { ...state.uploadResults };

        const uploadIdsToClear = Object.keys(newResults).filter((id) =>
          id.startsWith(`${serverId}_`) || (state.uploadResults[id]?.localConversationId === conversationId)
        );
        const progressIdsToClear = Object.keys(newProgress).filter((id) =>
           id.startsWith(`${serverId}_`)
        );

        if (uploadIdsToClear.length > 0) {
            uploadIdsToClear.forEach((id) => { delete newResults[id]; });
        }
         if (progressIdsToClear.length > 0) {
             progressIdsToClear.forEach((id) => { delete newProgress[id]; });
         }

        return { uploadProgress: newProgress, uploadResults: newResults };
      });
  },

  retryUpload: async (uploadId: string) => {
      const state = get();
      const failedUploadResult = state.uploadResults[uploadId];

      if (!failedUploadResult) {
          return;
      }
      const { audioUri, conversationId: serverId, audioKey, localConversationId: localId } = failedUploadResult;

      if (!audioUri || !serverId || !audioKey) {
          return;
      }
      if (!UUID_REGEX.test(serverId)) {
          return;
      }

      if (typeof localId === 'string') {
          await saveOrUpdatePendingUpload({
              conversationId: serverId,
              localConversationId: localId,
              audioUri,
              audioKey
          });
      } else {
          await saveOrUpdatePendingUpload({
              conversationId: serverId,
              audioUri,
              audioKey
          });
      }


      await state.uploadAudio(
        audioUri,
        serverId,
        audioKey,
        localId,
        true
      );
  },
});