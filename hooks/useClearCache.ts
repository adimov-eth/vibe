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
            console.warn(`[useClearCache] Failed to delete audio file ${result.audioUri}:`, deleteError);
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


      // 6. Clear Expo's general cache directory (optional, might remove other useful cache)
      // This is less critical now that we target specific audio files. Keep it for general cleanup.
      console.log("[useClearCache] Attempting to clear Expo FileSystem cache directory...");
      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        await FileSystem.deleteAsync(cacheDir, { idempotent: true });
        // Recreate the directory structure Expo might need
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
        console.log("[useClearCache] Cleared and recreated Expo cache directory.");
      } else {
          console.warn("[useClearCache] Could not determine cache directory.");
      }

      console.log("[useClearCache] Cache clearing process finished successfully.");

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[useClearCache] Failed to clear cache:', errorMessage);
      setError('Failed to clear cache. Please try again.');
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