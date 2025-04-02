import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as FileSystem from 'expo-file-system';
import * as TaskManager from 'expo-task-manager';
import { getAuthorizationHeader } from './auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
export const BACKGROUND_UPLOAD_TASK = "BACKGROUND_UPLOAD_TASK";
const PENDING_UPLOADS_KEY = '@background_uploads';

interface PendingUpload {
  audioUri: string;
  conversationId: string;
  audioKey: string;
  timestamp: number;
}

// Helper function to save pending uploads
export const savePendingUpload = async (upload: Omit<PendingUpload, 'timestamp'>): Promise<void> => {
  console.log(`[BackgroundUtil:savePendingUpload] Attempting to save: ConvID=${upload.conversationId}, Key=${upload.audioKey}, URI=${upload.audioUri}`);
  try {
    const existingUploadsStr = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
    let existingUploads: PendingUpload[] = existingUploadsStr ? JSON.parse(existingUploadsStr) : [];
    
    const newUpload: PendingUpload = {
      ...upload,
      timestamp: Date.now()
    };
    
    // Prevent duplicates based on conversationId and audioKey
    existingUploads = existingUploads.filter(
        item => !(item.conversationId === newUpload.conversationId && item.audioKey === newUpload.audioKey)
    );

    const uploads = [...existingUploads, newUpload];
    await AsyncStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(uploads));
    console.log(`[BackgroundUtil:savePendingUpload] Successfully saved. Total pending in AsyncStorage: ${uploads.length}`);
  } catch (error) {
    console.error('[BackgroundUtil:savePendingUpload] Error saving pending upload:', error);
  }
};

// Helper function to remove a pending upload
export const removePendingUpload = async (conversationId: string, audioKey: string): Promise<void> => {
  console.log(`[BackgroundUtil:removePendingUpload] Attempting to remove: ConvID=${conversationId}, Key=${audioKey}`);
  try {
    const existingUploadsStr = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
    if (!existingUploadsStr) {
        console.log(`[BackgroundUtil:removePendingUpload] No pending uploads found in AsyncStorage.`);
        return;
    }
    
    let existingUploads: PendingUpload[] = JSON.parse(existingUploadsStr);
    const initialCount = existingUploads.length;
    const filteredUploads = existingUploads.filter(
      upload => !(upload.conversationId === conversationId && upload.audioKey === audioKey)
    );
    
    if (filteredUploads.length < initialCount) {
        await AsyncStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(filteredUploads));
        console.log(`[BackgroundUtil:removePendingUpload] Removed successfully. Total remaining in AsyncStorage: ${filteredUploads.length}`);
    } else {
        console.log(`[BackgroundUtil:removePendingUpload] Item not found for ConvID=${conversationId}, Key=${audioKey}. No changes made.`);
    }
  } catch (error) {
    console.error('[BackgroundUtil:removePendingUpload] Error removing pending upload:', error);
  }
};

// Helper function to get all pending uploads
export const getPendingUploads = async (): Promise<PendingUpload[]> => {
  console.log(`[BackgroundUtil:getPendingUploads] Reading pending uploads from AsyncStorage key: ${PENDING_UPLOADS_KEY}`);
  try {
    const uploadsStr = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
    const uploads = uploadsStr ? JSON.parse(uploadsStr) : [];
    console.log(`[BackgroundUtil:getPendingUploads] Found ${uploads.length} items.`);
    return uploads;
  } catch (error) {
    console.error('[BackgroundUtil:getPendingUploads] Error getting pending uploads:', error);
    return [];
  }
};

// Helper function for background uploads
export const uploadAudioInBackground = async (
  audioUri: string,
  conversationId: string,
  audioKey: string
): Promise<void> => {
    console.log(`[BackgroundUtil:uploadAudioInBackground] STARTING background upload for ConvID=${conversationId}, Key=${audioKey}, URI=${audioUri}`);
    let authHeader: string | null = null;
    try {
        authHeader = await getAuthorizationHeader();
        if (!authHeader) {
            // Log specific error and throw
            console.error('[BackgroundUtil:uploadAudioInBackground] Failed to get authorization header.');
            throw new Error('401: No authentication token available for background upload');
        }
        console.log(`[BackgroundUtil:uploadAudioInBackground] Got auth header successfully.`);
    } catch (authError) {
        console.error('[BackgroundUtil:uploadAudioInBackground] Error getting authorization header:', authError);
        throw authError; // Re-throw auth error
    }

    // Check file existence
     try {
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
          console.error(`[BackgroundUtil:uploadAudioInBackground] File does not exist, cannot upload: ${audioUri}. Removing from pending.`);
          // Remove the pending upload if the file is gone
          await removePendingUpload(conversationId, audioKey);
          throw new Error(`Local file missing for background upload: ${audioUri}`);
      }
       console.log(`[BackgroundUtil:uploadAudioInBackground] File exists: ${audioUri}`);
    } catch (infoError) {
        console.error(`[BackgroundUtil:uploadAudioInBackground] Error checking file existence for ${audioUri}:`, infoError);
        throw infoError; // Re-throw error
    }

    try {
      console.log(`[BackgroundUtil:uploadAudioInBackground] Creating FileSystem UploadTask to ${API_URL}/audio/upload`);
      const uploadTask = FileSystem.createUploadTask(
        `${API_URL}/audio/upload`,
        audioUri,
        {
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: "audio",
          parameters: { conversationId, audioKey },
          headers: { Authorization: authHeader },
          mimeType: "audio/m4a",
          httpMethod: 'POST',
          sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
        }
      );
      console.log(`[BackgroundUtil:uploadAudioInBackground] Starting uploadTask.uploadAsync() for ${conversationId}_${audioKey}`);
      const response = await uploadTask.uploadAsync();
      console.log(`[BackgroundUtil:uploadAudioInBackground] uploadAsync() completed for ${conversationId}_${audioKey}. Status: ${response?.status}, Body snippet: ${response?.body?.substring(0, 200)}`);

      // Check for successful HTTP status codes more robustly
      if (!response || response.status < 200 || response.status >= 300) {
         const errorBody = response?.body ? `: ${response.body.substring(0, 100)}` : ''; // Limit error body length
         const errorMessage = `${response?.status || 'Network Error'}: Background upload failed${errorBody}`;
         console.error(`[BackgroundUtil:uploadAudioInBackground] Upload failed: ${errorMessage}`);
         throw new Error(errorMessage); // Throw error to keep it in pending list
      }
      
      // SUCCESS
      console.log(`[BackgroundUtil:uploadAudioInBackground] Background upload SUCCESSFUL for ${conversationId}_${audioKey}. Status: ${response.status}.`);
      // Remove from pending uploads on success (using Server ID)
      await removePendingUpload(conversationId, audioKey);
      
      // Delete local file on successful background upload
      try {
          console.log(`[BackgroundUtil:uploadAudioInBackground] Deleting local file ${audioUri} after successful background upload.`);
          await FileSystem.deleteAsync(audioUri, { idempotent: true });
          console.log(`[BackgroundUtil:uploadAudioInBackground] Deleted local file ${audioUri}.`);
      } catch (deleteError) {
           console.error(`[BackgroundUtil:uploadAudioInBackground] Failed to delete local file ${audioUri} after background upload: ${deleteError}`);
           // Don't throw here, upload succeeded, just failed cleanup
      }

    } catch(uploadError) {
       // Log error with details and re-throw
       console.error(`[BackgroundUtil:uploadAudioInBackground] CATCH block: Error during background upload task execution for ${conversationId}_${audioKey}:`, uploadError);
       throw uploadError; // Re-throw to be handled by TaskManager (keeps item in pending list)
    }
};

// Define background task
TaskManager.defineTask(BACKGROUND_UPLOAD_TASK, async () => {
  const taskStartTime = Date.now();
  console.log(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] TASK STARTING at ${new Date(taskStartTime).toISOString()}`);
  let processedCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let pendingUploads: PendingUpload[] = [];

  try {
    // Get all pending uploads from AsyncStorage
    pendingUploads = await getPendingUploads();
    
    if (pendingUploads.length === 0) {
      console.log(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] No pending uploads found in AsyncStorage. Exiting task.`);
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    console.log(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] Found ${pendingUploads.length} pending uploads in AsyncStorage. Processing...`);
    
    // Process each pending upload sequentially to avoid overwhelming network/system
    for (const upload of pendingUploads) {
        processedCount++;
        console.log(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] Processing item ${processedCount}/${pendingUploads.length}: ConvID=${upload.conversationId}, Key=${upload.audioKey}, URI=${upload.audioUri}`);
        // Basic check: Is conversationId likely a UUID (server) or could it be local?
        if (!upload.conversationId || upload.conversationId.length < 36) {
            console.warn(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] Skipping upload - invalid or potentially local conversationId found in AsyncStorage: ${upload.conversationId}`);
            // Should we remove this invalid entry? Maybe not automatically.
            failureCount++; // Count as failure for task result
            continue;
        }
        try {
            // Attempt the background upload
            await uploadAudioInBackground(
                upload.audioUri,
                upload.conversationId, // Pass the ID found in storage
                upload.audioKey
            );
            console.log(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] Successfully processed item: ConvID=${upload.conversationId}, Key=${upload.audioKey}`);
            successCount++;
        } catch (error) {
            console.error(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] Failed to upload item ConvID=${upload.conversationId}, Key=${upload.audioKey}:`, error);
            // Don't remove from pending uploads on failure - will retry next time TaskManager runs
            failureCount++;
        }
        // Optional: Add a small delay between uploads if needed
        // await new Promise(resolve => setTimeout(resolve, 500));
    }

    const taskEndTime = Date.now();
    console.log(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] TASK FINISHED in ${taskEndTime - taskStartTime}ms. Processed: ${processedCount}, Success: ${successCount}, Failed: ${failureCount}.`);

    // Determine result based on outcome
    if (successCount > 0) {
        return BackgroundFetch.BackgroundFetchResult.NewData; // Indicate new data was processed
    } else if (failureCount > 0 && processedCount > 0) {
        return BackgroundFetch.BackgroundFetchResult.Failed; // Indicate failure occurred
    } else {
        return BackgroundFetch.BackgroundFetchResult.NoData; // No uploads processed or none found initially
    }

  } catch (error) {
    const taskEndTime = Date.now();
    console.error(`[BackgroundTask:${BACKGROUND_UPLOAD_TASK}] CRITICAL TASK ERROR after ${taskEndTime - taskStartTime}ms:`, error);
    return BackgroundFetch.BackgroundFetchResult.Failed; // Critical failure of the task itself
  }
});

/**
 * Registers the background fetch task if not already registered.
 */
export const registerBackgroundUploadTask = async (): Promise<void> => {
    try {
         console.log(`[BackgroundUtil:registerBackgroundUploadTask] Attempting to register task: ${BACKGROUND_UPLOAD_TASK}`);
         const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_UPLOAD_TASK);
         if (!isRegistered) {
              // Consider a slightly longer interval for production, 5 min is good for testing
              const intervalMinutes = 5;
              await BackgroundFetch.registerTaskAsync(BACKGROUND_UPLOAD_TASK, {
                minimumInterval: 60 * intervalMinutes, // ~ every 5 minutes
                stopOnTerminate: false, // Keep running if app is terminated
                startOnBoot: true,      // Run after device boot
              });
              console.log(`[BackgroundUtil:registerBackgroundUploadTask] Background task '${BACKGROUND_UPLOAD_TASK}' registered with interval ~${intervalMinutes} minutes.`);
         } else {
              console.log(`[BackgroundUtil:registerBackgroundUploadTask] Background task '${BACKGROUND_UPLOAD_TASK}' already registered.`);
         }
         // Log current background fetch status (optional)
         const status = await BackgroundFetch.getStatusAsync();
         const statusString = status !== null ? BackgroundFetch.BackgroundFetchStatus[status] : 'Unknown (null)';
         console.log(`[BackgroundUtil:registerBackgroundUploadTask] Current BackgroundFetch status: ${status} (${statusString})`);

         // Optionally unregister all tasks and re-register for clean testing state
         // await TaskManager.unregisterAllTasksAsync(); console.log("Unregistered all tasks");

    } catch (e) {
         console.error("[BackgroundUtil:registerBackgroundUploadTask] Failed to register background upload task:", e);
    }
};