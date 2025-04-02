import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as FileSystem from 'expo-file-system';
import * as TaskManager from 'expo-task-manager';
import { getAuthorizationHeader } from './auth';
// Import the store hook to access the localToServerIds map
import useStore from '@/state';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
export const BACKGROUND_UPLOAD_TASK = "BACKGROUND_UPLOAD_TASK";
const PENDING_UPLOADS_KEY = '@background_uploads';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Updated interface: conversationId might be local initially.
// localConversationId stores the original local ID if conversationId holds the serverId.
export interface PendingUpload {
  conversationId: string; // Initially local ID, updated to server ID when known
  localConversationId?: string; // Store original local ID if conversationId is serverId
  audioUri: string;
  audioKey: string;
  timestamp: number; // When it was added/updated
  attemptCount: number; // Track attempts for backoff or max retries in background
}

// Helper function to get all pending uploads
export const getPendingUploads = async (): Promise<PendingUpload[]> => {
  console.log(`[BackgroundUtil:getPendingUploads] Reading pending uploads from AsyncStorage key: ${PENDING_UPLOADS_KEY}`);
  try {
    const uploadsStr = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
    const uploads = uploadsStr ? JSON.parse(uploadsStr) : [];
    console.log(`[BackgroundUtil:getPendingUploads] Found ${uploads.length} items.`);
    // Ensure default attemptCount is 0 if missing from older stored items
    return uploads.map((u: any) => ({ ...u, attemptCount: u.attemptCount ?? 0 }));
  } catch (error) {
    console.error('[BackgroundUtil:getPendingUploads] Error getting pending uploads:', error);
    return [];
  }
};

// Overwrite existing list with new list
export const setPendingUploads = async (uploads: PendingUpload[]): Promise<void> => {
    try {
        await AsyncStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(uploads));
        // Avoid logging potentially sensitive full upload list here
        // console.log(`[BackgroundUtil:setPendingUploads] Saved ${uploads.length} uploads.`);
    } catch (error) {
        console.error('[BackgroundUtil:setPendingUploads] Error saving uploads:', error);
    }
};


// Save or update a pending upload. Finds based on original localConversationId and key.
export const saveOrUpdatePendingUpload = async (
    uploadData: Omit<PendingUpload, 'timestamp' | 'attemptCount'> & { localConversationId?: string } // Make localConversationId optional here
): Promise<void> => {
    const findLocalId = uploadData.localConversationId || (UUID_REGEX.test(uploadData.conversationId) ? undefined : uploadData.conversationId);
    console.log(`[BackgroundUtil:saveOrUpdatePendingUpload] Saving/Updating: TargetConvID=${uploadData.conversationId}, OrigLocalID=${findLocalId || 'N/A'}, Key=${uploadData.audioKey}`);
    try {
        let uploads = await getPendingUploads();
        const now = Date.now();

        // Find existing index based on the original local ID (if available) and key
        const existingIndex = findLocalId ? uploads.findIndex(
            item => (item.localConversationId === findLocalId || item.conversationId === findLocalId) && item.audioKey === uploadData.audioKey
        ) : -1; // Cannot reliably find by local ID if not provided

        // Alternative find: If local ID wasn't provided/found, try finding by target conversationId (potentially serverId) and key
        let foundIndex = existingIndex;
        if (foundIndex === -1) {
             foundIndex = uploads.findIndex(item => item.conversationId === uploadData.conversationId && item.audioKey === uploadData.audioKey);
        }


        if (foundIndex !== -1) {
            // Update existing entry
            const existingUpload = uploads[foundIndex];
            uploads[foundIndex] = {
                ...existingUpload,
                ...uploadData, // Apply new data
                localConversationId: findLocalId || existingUpload.localConversationId, // Preserve original localId if possible
                timestamp: now, // Update timestamp on modification
                attemptCount: existingUpload.attemptCount,
            };
            console.log(`[BackgroundUtil:saveOrUpdatePendingUpload] Updated existing upload at index ${foundIndex}.`);
        } else {
            // Add new entry
            const newUpload: PendingUpload = {
                ...uploadData,
                localConversationId: findLocalId, // Store original localId if available
                timestamp: now,
                attemptCount: 0,
            };
            uploads.push(newUpload);
            console.log(`[BackgroundUtil:saveOrUpdatePendingUpload] Added new upload.`);
        }

        await setPendingUploads(uploads);
        console.log(`[BackgroundUtil:saveOrUpdatePendingUpload] Save complete. Total pending: ${uploads.length}`);

    } catch (error) {
        console.error('[BackgroundUtil:saveOrUpdatePendingUpload] Error saving/updating pending upload:', error);
    }
};


// Remove based on SERVER ID and audio key.
export const removePendingUpload = async (serverConversationId: string, audioKey: string): Promise<void> => {
  console.log(`[BackgroundUtil:removePendingUpload] Attempting to remove: ServerConvID=${serverConversationId}, Key=${audioKey}`);
  try {
    let uploads = await getPendingUploads();
    const initialCount = uploads.length;

    // Filter out based on SERVER ID and key
    // Also check if localConversationId maps to this serverId
    const localToServerIds = useStore.getState().localToServerIds;
    const filteredUploads = uploads.filter(upload => {
        const isDirectMatch = upload.conversationId === serverConversationId && upload.audioKey === audioKey;
        // Check if the stored local ID maps to the server ID we want to remove
        const isMappedMatch = upload.localConversationId && localToServerIds[upload.localConversationId] === serverConversationId && upload.audioKey === audioKey;
        // Check if the conversationId IS a local ID that maps to the server ID
        const isConvIdLocalMapped = !UUID_REGEX.test(upload.conversationId) && localToServerIds[upload.conversationId] === serverConversationId && upload.audioKey === audioKey;

        // Keep the item if NONE of the removal conditions match
        return !(isDirectMatch || isMappedMatch || isConvIdLocalMapped);
    });


    if (filteredUploads.length < initialCount) {
        await setPendingUploads(filteredUploads);
        console.log(`[BackgroundUtil:removePendingUpload] Removed successfully. Items removed: ${initialCount - filteredUploads.length}. Total remaining: ${filteredUploads.length}`);
    } else {
        console.log(`[BackgroundUtil:removePendingUpload] Item not found for ServerConvID=${serverConversationId}, Key=${audioKey}. No changes made.`);
    }
  } catch (error) {
    console.error('[BackgroundUtil:removePendingUpload] Error removing pending upload:', error);
  }
};


// Helper function for background uploads - expects SERVER ID
export const uploadAudioInBackground = async (
  pendingUpload: PendingUpload // Pass the whole object
): Promise<boolean> => { // Return true on success, false on failure
    const { audioUri, conversationId: serverConversationId, audioKey, localConversationId } = pendingUpload;
    // Basic check: Ensure serverConversationId looks like a UUID before proceeding
    if (!UUID_REGEX.test(serverConversationId)) {
        console.error(`[BackgroundUtil:uploadAudioInBackground] Invalid serverConversationId format: ${serverConversationId}. Aborting background upload.`);
        return false; // Cannot proceed without valid server ID
    }
    console.log(`[BackgroundUtil:uploadAudioInBackground] STARTING background upload for ServerConvID=${serverConversationId}, LocalConvID=${localConversationId || 'N/A'}, Key=${audioKey}, URI=${audioUri}`);

    // --- Authentication ---
    let authHeader: string | null = null;
    try {
        authHeader = await getAuthorizationHeader();
        if (!authHeader) {
            console.error('[BackgroundUtil:uploadAudioInBackground] Failed to get authorization header. Cannot proceed.');
            return false; // Non-recoverable without auth
        }
        // console.log(`[BackgroundUtil:uploadAudioInBackground] Got auth header.`); // Too verbose
    } catch (authError) {
        console.error('[BackgroundUtil:uploadAudioInBackground] Error getting authorization header:', authError);
        return false; // Non-recoverable without auth
    }

    // --- File Check ---
     try {
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
          console.error(`[BackgroundUtil:uploadAudioInBackground] File does not exist, cannot upload: ${audioUri}. Removing from pending.`);
          // Remove the pending upload if the file is gone - use SERVER ID
          await removePendingUpload(serverConversationId, audioKey);
          return false; // Cannot succeed without file
      }
       // console.log(`[BackgroundUtil:uploadAudioInBackground] File exists: ${audioUri}`); // Too verbose
    } catch (infoError) {
        console.error(`[BackgroundUtil:uploadAudioInBackground] Error checking file existence for ${audioUri}:`, infoError);
        return false; // Likely non-recoverable if we can't check file
    }

    // --- Upload ---
    try {
      // console.log(`[BackgroundUtil:uploadAudioInBackground] Creating FileSystem UploadTask to ${API_URL}/audio/upload`); // Too verbose
      const uploadTask = FileSystem.createUploadTask(
        `${API_URL}/audio/upload`,
        audioUri,
        {
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: "audio",
          // Ensure SERVER ID is sent to the backend
          parameters: { conversationId: serverConversationId, audioKey },
          headers: { Authorization: authHeader },
          mimeType: "audio/m4a", // Assuming m4a, might need to be dynamic
          httpMethod: 'POST',
          sessionType: FileSystem.FileSystemSessionType.BACKGROUND, // Crucial for background task
        }
      );
      // console.log(`[BackgroundUtil:uploadAudioInBackground] Starting uploadTask.uploadAsync() for ${serverConversationId}_${audioKey}`); // Too verbose
      const response = await uploadTask.uploadAsync();
      // console.log(`[BackgroundUtil:uploadAudioInBackground] uploadAsync() completed for ${serverConversationId}_${audioKey}. Status: ${response?.status}, Body snippet: ${response?.body?.substring(0, 200)}`); // Too verbose

      if (!response || response.status < 200 || response.status >= 300) {
         const errorBody = response?.body ? `: ${response.body.substring(0, 100)}` : '';
         const errorMessage = `${response?.status || 'Network Error'}: Background upload failed${errorBody}`;
         console.error(`[BackgroundUtil:uploadAudioInBackground] Upload failed: ${errorMessage}`);
         return false; // Indicate failure for this attempt
      }

      // --- Success ---
      console.log(`[BackgroundUtil:uploadAudioInBackground] Background upload SUCCESSFUL for ${serverConversationId}_${audioKey}. Status: ${response.status}.`);
      await removePendingUpload(serverConversationId, audioKey); // Remove from AsyncStorage

      // Delete local file on successful background upload
      try {
          // console.log(`[BackgroundUtil:uploadAudioInBackground] Deleting local file ${audioUri} after successful background upload.`); // Too verbose
          await FileSystem.deleteAsync(audioUri, { idempotent: true });
          console.log(`[BackgroundUtil:uploadAudioInBackground] Deleted local file ${audioUri}.`);
      } catch (deleteError) {
           console.error(`[BackgroundUtil:uploadAudioInBackground] Failed to delete local file ${audioUri} after background upload: ${deleteError}`);
           // Don't fail the overall result for cleanup failure
      }
      return true; // Indicate success

    } catch(uploadError) {
       console.error(`[BackgroundUtil:uploadAudioInBackground] CATCH block: Error during background upload task execution for ${serverConversationId}_${audioKey}:`, uploadError);
       return false; // Indicate failure for this attempt
    }
};

// Define background task
TaskManager.defineTask(BACKGROUND_UPLOAD_TASK, async () => {
  const taskStartTime = Date.now();
  console.log(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] TASK STARTING at ${new Date(taskStartTime).toISOString()}`);
  let processedCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;
  let pendingUploads: PendingUpload[] = [];

  try {
    pendingUploads = await getPendingUploads();

    if (pendingUploads.length === 0) {
      console.log(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] No pending uploads found. Exiting.`);
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    console.log(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] Found ${pendingUploads.length} pending uploads. Processing...`);

    // Get the current local->server ID map from the store state
    // Note: Zustand state might not be fully initialized when background task runs.
    // This is a limitation. A more robust solution would persist the map or query the server.
    // For now, we proceed assuming the map *might* be available.
    let localToServerIds: { [key: string]: string } = {};
    try {
       localToServerIds = useStore.getState().localToServerIds || {};
    } catch (storeError) {
        console.warn(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] Could not access Zustand state for localToServerIds. Map may be empty.`);
    }

    const uploadsToProcess = [...pendingUploads]; // Create a copy

    for (const upload of uploadsToProcess) {
        processedCount++;
        // console.log(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] Processing item ${processedCount}/${uploadsToProcess.length}: ConvID=${upload.conversationId}, LocalID=${upload.localConversationId || 'N/A'}, Key=${upload.audioKey}`); // Verbose

        let serverIdToUse: string | undefined = undefined;
        const originalLocalId = upload.localConversationId || (UUID_REGEX.test(upload.conversationId) ? null : upload.conversationId);

        // 1. Check if conversationId is already a server ID
        if (UUID_REGEX.test(upload.conversationId)) {
            serverIdToUse = upload.conversationId;
        } else {
            // 2. If not, treat conversationId as localId and check map
            const mappedServerId = localToServerIds[upload.conversationId];
            if (mappedServerId) {
                serverIdToUse = mappedServerId;
                console.log(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] Found mapped Server ID ${serverIdToUse} for Local ID ${upload.conversationId}. Updating record.`);
                // Update the record in AsyncStorage for future runs
                 await saveOrUpdatePendingUpload({
                    ...upload,
                    conversationId: serverIdToUse, // Update to server ID
                    localConversationId: upload.conversationId, // Store original local ID
                 });
            } else {
                // 3. No server ID known. Skip.
                 console.warn(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] Server ID for Local ID ${upload.conversationId} not found in map. Skipping background upload attempt.`);
                skippedCount++;
                continue;
            }
        }

        // --- Attempt Upload if Server ID is known ---
        if (serverIdToUse) {
            // Reconstruct the object with potentially updated server ID and definite local ID
            const uploadObjectWithServerId: PendingUpload = {
                ...upload,
                conversationId: serverIdToUse, // Use the determined server ID
                localConversationId: originalLocalId || undefined, // Use the original local ID
            };

            const success = await uploadAudioInBackground(uploadObjectWithServerId);

            if (success) {
                successCount++;
            } else {
                failureCount++;
                // Increment attempt count in AsyncStorage
                 try {
                      const currentUploads = await getPendingUploads();
                      // Find by URI as it should be unique for the pending item
                      const indexToUpdate = currentUploads.findIndex(u => u.audioUri === upload.audioUri);
                      if (indexToUpdate !== -1) {
                         const currentAttemptCount = currentUploads[indexToUpdate].attemptCount || 0;
                         // Avoid excessive attempts if desired
                         // if (currentAttemptCount < MAX_BACKGROUND_ATTEMPTS) {
                             currentUploads[indexToUpdate].attemptCount = currentAttemptCount + 1;
                             await setPendingUploads(currentUploads);
                             console.log(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] Incremented attempt count to ${currentAttemptCount + 1} for failed upload: ${upload.audioKey}`);
                         // } else {
                         //    console.warn(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] Max attempt count reached for ${upload.audioKey}. Leaving as is.`);
                         // }
                      }
                 } catch(e) { console.error("Failed to update attempt count", e)}
            }
        } else {
             console.error(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] Logic error: Reached upload step without a Server ID for ${upload.audioKey}`);
             skippedCount++;
        }
    }

    const taskEndTime = Date.now();
    console.log(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] TASK FINISHED in ${taskEndTime - taskStartTime}ms. Processed: ${processedCount}, Success: ${successCount}, Failed: ${failureCount}, Skipped (No ServerID): ${skippedCount}.`);

    if (successCount > 0) return BackgroundFetch.BackgroundFetchResult.NewData;
    if (failureCount > 0) return BackgroundFetch.BackgroundFetchResult.Failed;
    return BackgroundFetch.BackgroundFetchResult.NoData;

  } catch (error) {
    const taskEndTime = Date.now();
    console.error(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] CRITICAL TASK ERROR after ${taskEndTime - taskStartTime}ms:`, error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Registers the background fetch task if not already registered.
 */
export const registerBackgroundUploadTask = async (): Promise<void> => {
    try {
         // console.log(`[BackgroundUtil:registerBackgroundUploadTask] Attempting to register task: ${BACKGROUND_UPLOAD_TASK}`); // Verbose
         const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_UPLOAD_TASK);
         if (!isRegistered) {
              const intervalMinutes = 5;
              await BackgroundFetch.registerTaskAsync(BACKGROUND_UPLOAD_TASK, {
                minimumInterval: 60 * intervalMinutes,
                stopOnTerminate: false,
                startOnBoot: true,
              });
              console.log(`[BackgroundUtil:registerBackgroundUploadTask] Background task '${BACKGROUND_UPLOAD_TASK}' registered with interval ~${intervalMinutes} minutes.`);
         } else {
              // console.log(`[BackgroundUtil:registerBackgroundUploadTask] Background task '${BACKGROUND_UPLOAD_TASK}' already registered.`); // Verbose
         }
         const status = await BackgroundFetch.getStatusAsync();
         const statusString = status !== null ? BackgroundFetch.BackgroundFetchStatus[status] : 'Unknown (null)';
         console.log(`[BackgroundUtil:registerBackgroundUploadTask] Current BackgroundFetch status: ${status} (${statusString})`);
    } catch (e) {
         console.error("[BackgroundUtil:registerBackgroundUploadTask] Failed to register background upload task:", e);
    }
};