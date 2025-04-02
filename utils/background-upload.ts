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
  try {
    const existingUploadsStr = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
    const existingUploads: PendingUpload[] = existingUploadsStr ? JSON.parse(existingUploadsStr) : [];
    
    const newUpload: PendingUpload = {
      ...upload,
      timestamp: Date.now()
    };
    
    const uploads = [...existingUploads, newUpload];
    await AsyncStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(uploads));
    console.log(`Saved pending upload for ${upload.conversationId}_${upload.audioKey}`);
  } catch (error) {
    console.error('Error saving pending upload:', error);
  }
};

// Helper function to remove a pending upload
export const removePendingUpload = async (conversationId: string, audioKey: string): Promise<void> => {
  try {
    const existingUploadsStr = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
    if (!existingUploadsStr) return;
    
    const existingUploads: PendingUpload[] = JSON.parse(existingUploadsStr);
    const filteredUploads = existingUploads.filter(
      upload => !(upload.conversationId === conversationId && upload.audioKey === audioKey)
    );
    
    await AsyncStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(filteredUploads));
    console.log(`Removed pending upload for ${conversationId}_${audioKey}`);
  } catch (error) {
    console.error('Error removing pending upload:', error);
  }
};

// Helper function to get all pending uploads
export const getPendingUploads = async (): Promise<PendingUpload[]> => {
  try {
    const uploadsStr = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
    return uploadsStr ? JSON.parse(uploadsStr) : [];
  } catch (error) {
    console.error('Error getting pending uploads:', error);
    return [];
  }
};

// Helper function for background uploads
export const uploadAudioInBackground = async (
  audioUri: string,
  conversationId: string,
  audioKey: string
): Promise<void> => {
    const authHeader = await getAuthorizationHeader();
    if (!authHeader) {
        throw new Error('401: No authentication token available for background upload');
    }
    try {
      const uploadTask = FileSystem.createUploadTask(
        `${API_URL}/audio/upload`,
        audioUri,
        {
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: "audio",
          parameters: { conversationId, audioKey },
          headers: { Authorization: authHeader },
          mimeType: "audio/m4a",
        }
      );
      const response = await uploadTask.uploadAsync();
      // Check for successful HTTP status codes
      if (!response || (response.status !== 200 && response.status !== 201)) {
         const errorBody = response?.body ? `: ${response.body.substring(0, 100)}` : ''; // Limit error body length
         throw new Error(`${response?.status || 'Network Error'}: Upload failed${errorBody}`);
      }
      
      // Remove from pending uploads on success
      await removePendingUpload(conversationId, audioKey);
      
      // Delete local file on successful upload
      await FileSystem.deleteAsync(audioUri, { idempotent: true });
      console.log(`Background upload successful and file deleted: ${conversationId}_${audioKey}`);
    } catch(uploadError) {
       console.error(`Error during background upload task execution for ${conversationId}_${audioKey}: ${uploadError}`);
       throw uploadError; // Re-throw to be handled by TaskManager
    }
};

// Define background task
TaskManager.defineTask(BACKGROUND_UPLOAD_TASK, async () => {
  try {
    // Get all pending uploads
    const pendingUploads = await getPendingUploads();
    if (pendingUploads.length === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    console.log(`Processing ${pendingUploads.length} pending uploads`);
    
    // Process each pending upload
    const uploadPromises = pendingUploads.map(async (upload) => {
      try {
        await uploadAudioInBackground(
          upload.audioUri,
          upload.conversationId,
          upload.audioKey
        );
        return true;
      } catch (error) {
        console.error(`Failed to upload ${upload.conversationId}_${upload.audioKey}:`, error);
        // Don't remove from pending uploads on failure - will retry next time
        return false;
      }
    });

    const results = await Promise.all(uploadPromises);
    const successCount = results.filter(Boolean).length;

    console.log(`Completed background upload task. Success: ${successCount}/${pendingUploads.length}`);
    return successCount > 0 
      ? BackgroundFetch.BackgroundFetchResult.NewData 
      : BackgroundFetch.BackgroundFetchResult.Failed;
  } catch (error) {
    console.error('Background task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Registers the background fetch task if not already registered.
 */
export const registerBackgroundUploadTask = async (): Promise<void> => {
    try {
         const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_UPLOAD_TASK);
         if (!isRegistered) {
              await BackgroundFetch.registerTaskAsync(BACKGROUND_UPLOAD_TASK, {
                minimumInterval: 60 * 5, // ~ every 5 minutes (adjust as needed)
                stopOnTerminate: false,
                startOnBoot: true,
              });
              console.log(`Background task '${BACKGROUND_UPLOAD_TASK}' registered.`);
         } else {
              console.log(`Background task '${BACKGROUND_UPLOAD_TASK}' already registered.`);
         }
    } catch (e) {
         console.error("Failed to register background upload task:", e);
    }
};