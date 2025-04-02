import useStore from '@/state';
// Import AsyncStorage utilities for pending uploads
import { getPendingUploads, setPendingUploads } from '@/utils/background-upload';
import * as FileSystem from 'expo-file-system';
import { useState } from 'react';

export const useClearCache = () => {
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearCache = async () => {
    setIsClearing(true);
    setError(null);
    console.log("[useClearCache] Starting cache clearing process...");

    try {
      // 1. Clear conversations from store
      console.log("[useClearCache] Clearing conversations state...");
      useStore.getState().clearConversations();

      // 2. Clear websocket messages
      console.log("[useClearCache] Clearing websocket messages state...");
      useStore.getState().clearMessages();

      // 3. Attempt to delete local audio files from upload results
      console.log("[useClearCache] Attempting to delete local audio files tracked in uploadResults...");
      const uploadResults = { ...useStore.getState().uploadResults };
      let deletedFilesCount = 0;
      for (const uploadId in uploadResults) {
        const result = uploadResults[uploadId];
        if (result?.audioUri) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(result.audioUri);
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(result.audioUri, { idempotent: true });
              // console.log(`[useClearCache] Deleted audio file: ${result.audioUri}`); // Verbose
              deletedFilesCount++;
            }
          } catch (deleteError) {
            console.warn(`[useClearCache] Failed to delete specific audio file ${result.audioUri}:`, deleteError);
          }
        }
      }
      console.log(`[useClearCache] Attempted deletion of ${deletedFilesCount} audio files from uploadResults.`);

      // 4. Clear all upload *UI* states (progress, results map)
      console.log("[useClearCache] Clearing upload UI state (progress, results)...");
      const conversations = Object.keys(useStore.getState().conversations);
      // Clear state associated with known conversations
      for (const conversationId of conversations) {
         useStore.getState().clearUploadState(conversationId);
      }
      // Also reset the entire maps to clear any orphaned entries
      useStore.setState({ uploadProgress: {}, uploadResults: {} });


      // 5. Clear pending background uploads from AsyncStorage
      console.log("[useClearCache] Clearing pending background uploads from AsyncStorage...");
      const pending = await getPendingUploads();
      if (pending.length > 0) {
         await setPendingUploads([]); // Overwrite with empty array
         console.log(`[useClearCache] Cleared ${pending.length} pending uploads from AsyncStorage.`);
      } else {
          console.log("[useClearCache] No pending uploads found in AsyncStorage to clear.");
      }


      // 6. Clear contents of Expo's general cache directory
      console.log("[useClearCache] Attempting to clear contents of Expo FileSystem cache directory...");
      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
          console.log(`[useClearCache] Cache directory identified: ${cacheDir}`);
          try {
              const items = await FileSystem.readDirectoryAsync(cacheDir);
              if (items.length > 0) {
                  console.log(`[useClearCache] Found ${items.length} items in cache directory. Deleting...`);
                  let deletedCount = 0;
                  for (const item of items) {
                      const itemPath = `${cacheDir}${item}`; // Construct full path
                      try {
                          await FileSystem.deleteAsync(itemPath, { idempotent: true });
                          deletedCount++;
                      } catch (itemDeleteError) {
                          console.warn(`[useClearCache] Failed to delete cache item: ${itemPath}`, itemDeleteError);
                      }
                  }
                   console.log(`[useClearCache] Deleted ${deletedCount}/${items.length} items from cache directory.`);
              } else {
                   console.log("[useClearCache] Cache directory is empty. No items to delete.");
              }
          } catch (readDirError) {
              // Log the specific error encountered during directory read/delete
              const errorMsg = readDirError instanceof Error ? readDirError.message : String(readDirError);
              console.warn(`[useClearCache] Could not clear cache directory contents: ${errorMsg}`);
              // Don't throw an error to the user for this step failing
          }
      } else {
          console.warn("[useClearCache] Could not determine cache directory. Skipping step 6.");
      }

      console.log("[useClearCache] Cache clearing process finished.");

    } catch (err) {
      // Catch errors from critical steps (state clearing, AsyncStorage)
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[useClearCache] Critical error during cache clearing:', errorMessage);
      setError('Failed to clear essential cache data. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  return {
    clearCache,
    isClearing,
    error
  };
}; 