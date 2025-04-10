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
  
  // UUID regex for validation
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  /**
   * Creates the upload slice for the global state store
   * Handles file uploads, tracking upload progress, and mapping local to server IDs
   */
  export const createUploadSlice: StateCreator<StoreState, [], [], UploadSlice> = (
    set,
    get
  ) => ({
    // State
    uploadProgress: {},
    uploadResults: {},
    localToServerIds: {},
  
    /**
     * Initialize uploads from persistent storage on app start
     */
    initializeUploads: async () => {
      try {
        // Get all pending uploads and current ID mappings
        const persistedPendingUploads = await getPendingUploads();
        const currentLocalToServerIds = get().localToServerIds;
  
        if (persistedPendingUploads.length > 0) {
          // Process each pending upload
          for (const upload of persistedPendingUploads) {
            // Determine the server ID to use
            let serverIdToUse: string | undefined = undefined;
            const localId: string | undefined = upload.localConversationId || 
                                               (!UUID_REGEX.test(upload.conversationId) ? upload.conversationId : undefined);
  
            // If already a server ID, use it directly
            if (UUID_REGEX.test(upload.conversationId)) {
              serverIdToUse = upload.conversationId;
            } else if (localId) {
              // Try to find mapped server ID
              serverIdToUse = currentLocalToServerIds[localId];
            }
  
            // Skip if no server ID available
            if (!serverIdToUse) {
              continue;
            }
            
            // Create unique upload ID
            const uploadId = `${serverIdToUse}_${upload.audioKey}`;
            
            // Check if already processed or in progress
            const existingResult = get().uploadResults[uploadId];
            const currentProgress = get().uploadProgress[uploadId];
            
            if (existingResult?.success || (currentProgress !== undefined && currentProgress >= 0)) {
              // Clear successfully completed uploads
              if (existingResult?.success) {
                await removePendingUpload(serverIdToUse, upload.audioKey, currentLocalToServerIds);
              }
              continue;
            }
  
            // Start upload process for this pending upload
            await get().uploadAudio(
              upload.audioUri,
              serverIdToUse, 
              upload.audioKey,
              localId, 
              true
            );
          }
        }
      } catch {
        // Non-critical initialization error
      }
    },
  
    /**
     * Map a local ID to a server ID
     */
    setLocalToServerId: async (localId: string, serverId: string) => {
      const currentMap = get().localToServerIds;
      const previouslyUnmapped = !currentMap[localId];
      const updatedMap = { ...currentMap, [localId]: serverId };
  
      // Update state with new mapping
      set({ localToServerIds: updatedMap });
  
      // Persist mapping to storage
      try {
        await setStoredIdMap(updatedMap);
      } catch {
        // Non-critical storage error
      }
  
      // If this is a new mapping, check for pending uploads that need updating
      if (previouslyUnmapped) {
        try {
          const persistedUploads = await getPendingUploads();
          const uploadsForLocalId = persistedUploads.filter(
            upload => upload.conversationId === localId
          );
  
          // Update each upload with the new server ID
          for (const upload of uploadsForLocalId) {
            // Update the upload with server ID
            await saveOrUpdatePendingUpload({
              ...upload,
              conversationId: serverId,
              localConversationId: localId,
            });
            
            // Check if upload is already in progress or complete
            const uploadId = `${serverId}_${upload.audioKey}`;
            const existingResult = get().uploadResults[uploadId];
            const currentProgress = get().uploadProgress[uploadId];
            
            if (existingResult?.success || (currentProgress !== undefined && currentProgress >= 0)) {
              // Clean up completed uploads
              if (existingResult?.success) {
                await removePendingUpload(serverId, upload.audioKey, updatedMap);
              }
              continue;
            }
  
            // Start upload process for this upload
            await get().uploadAudio(
              upload.audioUri,
              serverId,
              upload.audioKey,
              localId, 
              true
            );
          }
        } catch {
          // Non-critical error
        }
      }
    },
  
    /**
     * Save an upload intent for background processing
     */
    saveUploadIntent: async (localConversationId: string, audioUri: string, audioKey: string) => {
      const currentLocalToServerIds = get().localToServerIds;
      const serverId = currentLocalToServerIds[localConversationId];
  
      // Save the upload intent regardless of server ID
      await saveOrUpdatePendingUpload({
        conversationId: serverId || localConversationId,
        localConversationId: localConversationId,
        audioUri,
        audioKey
      });
      
      // If server ID is available, start upload immediately
      if (serverId) {
        const uploadId = `${serverId}_${audioKey}`;
        const existingResult = get().uploadResults[uploadId];
        const currentProgress = get().uploadProgress[uploadId];
  
        // Skip if already processed or in progress
        if (existingResult?.success || (currentProgress !== undefined && currentProgress >= 0)) {
          if (existingResult?.success) {
            await removePendingUpload(serverId, audioKey, currentLocalToServerIds);
          }
        } else {
          // Start upload
          await get().uploadAudio(audioUri, serverId, audioKey, localConversationId);
        }
      }
    },
  
    /**
     * Perform audio file upload
     */
    uploadAudio: async (
      audioUri: string,
      conversationId: string,
      audioKey: string,
      localConversationId?: string,
      isPersistedRetry: boolean = false
    ) => {
      // Validate server ID format
      if (!UUID_REGEX.test(conversationId)) {
        const tempUploadId = `${localConversationId || conversationId}_${audioKey}`;
        set((state) => ({
          uploadResults: { 
            ...state.uploadResults, 
            [tempUploadId]: { 
              success: false, 
              error: 'Internal Error: Invalid Server ID for upload', 
              audioUri, 
              conversationId, 
              audioKey, 
              localConversationId 
            }
          },
          uploadProgress: { ...state.uploadProgress, [tempUploadId]: -1 },
        }));
        return;
      }
  
      const uploadId = `${conversationId}_${audioKey}`;
      const currentLocalToServerIds = get().localToServerIds;
      
      // Check if file exists
      try {
        const fileInfo = await FileSystem.getInfoAsync(audioUri);
        if (!fileInfo.exists) {
          set((state) => ({
            uploadResults: { 
              ...state.uploadResults, 
              [uploadId]: { 
                success: false, 
                error: 'Local file missing', 
                audioUri, 
                conversationId, 
                audioKey, 
                localConversationId 
              }
            },
            uploadProgress: { ...state.uploadProgress, [uploadId]: -1 },
          }));
          await removePendingUpload(conversationId, audioKey, currentLocalToServerIds);
          return;
        }
      } catch (infoError) {
        const errorMessage = infoError instanceof Error ? infoError.message : String(infoError);
        set((state) => ({
          uploadResults: { 
            ...state.uploadResults, 
            [uploadId]: { 
              success: false, 
              error: `File check error: ${errorMessage}`, 
              audioUri, 
              conversationId, 
              audioKey, 
              localConversationId 
            }
          },
          uploadProgress: { ...state.uploadProgress, [uploadId]: -1 },
        }));
        return;
      }
  
      // Perform upload
      try {
        // Initialize upload state
        set((state) => ({
          uploadProgress: { ...state.uploadProgress, [uploadId]: 0 },
          uploadResults: { 
            ...state.uploadResults, 
            [uploadId]: { 
              success: false, 
              error: undefined, 
              audioUri, 
              conversationId, 
              audioKey, 
              localConversationId 
            }
          }
        }));
  
        // Upload the file with progress tracking
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
  
        // Update final result
        set((state) => ({
          uploadResults: {
            ...state.uploadResults,
            [uploadId]: { 
              ...result, 
              audioUri, 
              conversationId, 
              audioKey, 
              localConversationId 
            },
          },
          uploadProgress: { 
            ...state.uploadProgress, 
            [uploadId]: result.success ? 100 : -1 
          },
        }));
  
        // Cleanup after successful upload
        if (result.success) {
          await removePendingUpload(conversationId, audioKey, currentLocalToServerIds);
  
          try {
            await FileSystem.deleteAsync(audioUri, { idempotent: true });
          } catch {
            // Non-critical file deletion error
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set((state) => ({
          uploadResults: {
            ...state.uploadResults,
            [uploadId]: { 
              success: false, 
              error: `Uncaught: ${errorMessage}`, 
              audioUri, 
              conversationId, 
              audioKey, 
              localConversationId 
            },
          },
          uploadProgress: { ...state.uploadProgress, [uploadId]: -1 },
        }));
      }
    },
  
    /**
     * Clear upload state for a conversation
     */
    clearUploadState: (conversationId: string) => {
      set((state) => {
        const serverId = state.localToServerIds[conversationId] || conversationId;
        const newProgress = { ...state.uploadProgress };
        const newResults = { ...state.uploadResults };
  
        // Find IDs to clear by prefix or local ID reference
        const uploadIdsToClear = Object.keys(newResults).filter((id) =>
          id.startsWith(`${serverId}_`) || (state.uploadResults[id]?.localConversationId === conversationId)
        );
        
        const progressIdsToClear = Object.keys(newProgress).filter((id) =>
          id.startsWith(`${serverId}_`)
        );
  
        // Clear the found IDs
        uploadIdsToClear.forEach((id) => { delete newResults[id]; });
        progressIdsToClear.forEach((id) => { delete newProgress[id]; });
  
        return { uploadProgress: newProgress, uploadResults: newResults };
      });
    },
  
    /**
     * Retry a failed upload
     */
    retryUpload: async (uploadId: string) => {
      const state = get();
      const failedUploadResult = state.uploadResults[uploadId];
  
      if (!failedUploadResult) {
        return;
      }
      
      const { audioUri, conversationId: serverId, audioKey, localConversationId: localId } = failedUploadResult;
  
      // Validate required parameters
      if (!audioUri || !serverId || !audioKey) {
        return;
      }
      
      // Check server ID format
      if (!UUID_REGEX.test(serverId)) {
        return;
      }
  
      // Save the upload intent for retry
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
  
      // Retry the upload
      await state.uploadAudio(
        audioUri,
        serverId,
        audioKey,
        localId,
        true
      );
    },
  });