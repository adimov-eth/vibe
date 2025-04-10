import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as FileSystem from 'expo-file-system';
import * as TaskManager from 'expo-task-manager';
import { getAuthorizationHeader } from './auth';

// Constants
const API_URL = process.env.EXPO_PUBLIC_API_URL;
export const BACKGROUND_UPLOAD_TASK = "BACKGROUND_UPLOAD_TASK";
const PENDING_UPLOADS_KEY = '@background_uploads';
const ID_MAP_KEY = '@local_to_server_id_map';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Types
export interface PendingUpload {
  conversationId: string;
  localConversationId?: string;
  audioUri: string;
  audioKey: string;
  timestamp: number;
  attemptCount: number;
}

type LocalToServerIdMap = { [key: string]: string };

/**
 * Get mapping between local and server IDs from storage
 */
export const getStoredIdMap = async (): Promise<LocalToServerIdMap> => {
  try {
    const mapStr = await AsyncStorage.getItem(ID_MAP_KEY);
    return mapStr ? JSON.parse(mapStr) : {};
  } catch {
    return {};
  }
};

/**
 * Save mapping between local and server IDs to storage
 */
export const setStoredIdMap = async (idMap: LocalToServerIdMap): Promise<void> => {
  try {
    await AsyncStorage.setItem(ID_MAP_KEY, JSON.stringify(idMap));
  } catch {
    // Ignore storage errors
  }
};

/**
 * Get all pending uploads from storage
 */
export const getPendingUploads = async (): Promise<PendingUpload[]> => {
  try {
    const uploadsStr = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
    const uploads = uploadsStr ? JSON.parse(uploadsStr) : [];
    // Ensure all uploads have attempt count
    return uploads.map((u: any) => ({ ...u, attemptCount: u.attemptCount ?? 0 }));
  } catch {
    return [];
  }
};

/**
 * Save pending uploads to storage
 */
export const setPendingUploads = async (uploads: PendingUpload[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(uploads));
  } catch {
    // Ignore storage errors
  }
};

/**
 * Save or update a pending upload
 * If an existing upload with the same ID exists, it will be updated
 */
export const saveOrUpdatePendingUpload = async (
  uploadData: Omit<PendingUpload, 'timestamp' | 'attemptCount'> & { localConversationId?: string }
): Promise<void> => {
  try {
    // Find the local ID, which could be either localConversationId or conversationId
    const localId = uploadData.localConversationId || 
      (!UUID_REGEX.test(uploadData.conversationId) ? uploadData.conversationId : undefined);
    
    // Get current uploads
    let uploads = await getPendingUploads();
    const now = Date.now();
    
    // Find existing upload by local ID or by direct conversation ID
    let foundIndex = -1;
    
    // First try to find by local ID
    if (localId) {
      foundIndex = uploads.findIndex(
        item => (item.localConversationId === localId || item.conversationId === localId) && 
                item.audioKey === uploadData.audioKey
      );
    }
    
    // If not found, try by direct conversation ID
    if (foundIndex === -1) {
      foundIndex = uploads.findIndex(
        item => item.conversationId === uploadData.conversationId && 
                item.audioKey === uploadData.audioKey
      );
    }
    
    if (foundIndex !== -1) {
      // Update existing upload
      const existingUpload = uploads[foundIndex];
      uploads[foundIndex] = {
        ...existingUpload,
        ...uploadData,
        localConversationId: localId || existingUpload.localConversationId,
        timestamp: now,
        attemptCount: existingUpload.attemptCount,
      };
    } else {
      // Create new upload
      const newUpload: PendingUpload = {
        ...uploadData,
        localConversationId: localId,
        timestamp: now,
        attemptCount: 0,
      };
      uploads.push(newUpload);
    }
    
    // Save updated uploads
    await setPendingUploads(uploads);
  } catch {
    // Ignore errors
  }
};

/**
 * Remove a pending upload by ID after successful upload
 */
export const removePendingUpload = async (
  serverConversationId: string,
  audioKey: string,
  localToServerIds: LocalToServerIdMap
): Promise<void> => {
  try {
    let uploads = await getPendingUploads();
    const initialCount = uploads.length;
    
    // Filter out uploads that match the provided criteria
    const filteredUploads = uploads.filter(upload => {
      // Direct match by server ID
      const isDirectMatch = upload.conversationId === serverConversationId && 
                           upload.audioKey === audioKey;
      
      // Match by mapped local ID
      const isMappedMatch = upload.localConversationId && 
                           localToServerIds[upload.localConversationId] === serverConversationId && 
                           upload.audioKey === audioKey;
      
      // Match when the conversation ID itself is a local ID
      const isConvIdLocalMapped = !UUID_REGEX.test(upload.conversationId) && 
                                 localToServerIds[upload.conversationId] === serverConversationId && 
                                 upload.audioKey === audioKey;
      
      // Keep uploads that don't match any criteria
      return !(isDirectMatch || isMappedMatch || isConvIdLocalMapped);
    });
    
    // Save only if changes were made
    if (filteredUploads.length < initialCount) {
      await setPendingUploads(filteredUploads);
    }
  } catch {
    // Ignore errors
  }
};

/**
 * Upload audio file to the server in background
 */
export const uploadAudioInBackground = async (
  pendingUpload: PendingUpload,
  localToServerIds: LocalToServerIdMap
): Promise<boolean> => {
  const { audioUri, conversationId: serverConversationId, audioKey, localConversationId } = pendingUpload;
  
  // Validate server ID format
  if (!UUID_REGEX.test(serverConversationId)) {
    return false;
  }
  
  // Get auth token
  let authHeader: string | null = null;
  try {
    authHeader = await getAuthorizationHeader();
    if (!authHeader) {
      return false;
    }
  } catch {
    return false;
  }
  
  // Verify file exists
  try {
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) {
      await removePendingUpload(serverConversationId, audioKey, localToServerIds);
      return false;
    }
  } catch {
    return false;
  }
  
  // Perform the upload
  try {
    const uploadTask = FileSystem.createUploadTask(
      `${API_URL}/audio/upload`,
      audioUri,
      {
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "audio",
        parameters: { conversationId: serverConversationId, audioKey },
        headers: { Authorization: authHeader },
        mimeType: "audio/m4a",
        httpMethod: 'POST',
        sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
      }
    );
    
    const response = await uploadTask.uploadAsync();
    
    // Check for success
    if (!response || response.status < 200 || response.status >= 300) {
      return false;
    }
    
    // Clean up after successful upload
    await removePendingUpload(serverConversationId, audioKey, localToServerIds);
    
    try {
      await FileSystem.deleteAsync(audioUri, { idempotent: true });
    } catch {
      // Non-critical error, file cleanup can be retried later
    }
    
    return true;
  } catch {
    return false;
  }
};

/**
 * Background task to process pending uploads
 */
TaskManager.defineTask(BACKGROUND_UPLOAD_TASK, async () => {
  let processedCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;
  
  try {
    // Get all pending uploads
    const pendingUploads = await getPendingUploads();
    
    if (pendingUploads.length === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    
    // Get ID mappings
    let localToServerIds: LocalToServerIdMap = {};
    try {
      localToServerIds = await getStoredIdMap();
    } catch {
      // Continue with empty map if error
    }
    
    // Process each upload
    const uploadsToProcess = [...pendingUploads];
    
    for (const upload of uploadsToProcess) {
      processedCount++;
      
      // Find server ID to use
      let serverIdToUse: string | undefined = undefined;
      const originalLocalId = upload.localConversationId || 
                             (!UUID_REGEX.test(upload.conversationId) ? upload.conversationId : null);
      
      // If already a server ID, use it directly
      if (UUID_REGEX.test(upload.conversationId)) {
        serverIdToUse = upload.conversationId;
      } else {
        // Try to find mapped server ID
        const mappedServerId = localToServerIds[upload.conversationId];
        if (mappedServerId) {
          // Update the upload with the server ID
          serverIdToUse = mappedServerId;
          await saveOrUpdatePendingUpload({
            ...upload,
            conversationId: serverIdToUse,
            localConversationId: upload.conversationId,
          });
        } else {
          // Skip if no server ID is available
          skippedCount++;
          continue;
        }
      }
      
      if (serverIdToUse) {
        // Prepare upload with server ID
        const uploadObjectWithServerId: PendingUpload = {
          ...upload,
          conversationId: serverIdToUse,
          localConversationId: originalLocalId || undefined,
        };
        
        // Attempt upload
        const success = await uploadAudioInBackground(uploadObjectWithServerId, localToServerIds);
        
        if (success) {
          successCount++;
        } else {
          failureCount++;
          
          // Increment attempt count for failed upload
          try {
            const currentUploads = await getPendingUploads();
            const indexToUpdate = currentUploads.findIndex(u => u.audioUri === upload.audioUri);
            if (indexToUpdate !== -1) {
              const currentAttemptCount = currentUploads[indexToUpdate].attemptCount || 0;
              currentUploads[indexToUpdate].attemptCount = currentAttemptCount + 1;
              await setPendingUploads(currentUploads);
            }
          } catch {
            // Ignore errors when updating attempt count
          }
        }
      } else {
        skippedCount++;
      }
    }
    
    // Return appropriate result based on counts
    if (successCount > 0) return BackgroundFetch.BackgroundFetchResult.NewData;
    if (failureCount > 0) return BackgroundFetch.BackgroundFetchResult.Failed;
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register the background upload task
 */
export const registerBackgroundUploadTask = async (): Promise<void> => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_UPLOAD_TASK);
    
    if (!isRegistered) {
      // Register task with reasonable interval
      const intervalMinutes = 5;
      await BackgroundFetch.registerTaskAsync(BACKGROUND_UPLOAD_TASK, {
        minimumInterval: 60 * intervalMinutes,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch {
    // Non-critical error, can retry later
  }
};