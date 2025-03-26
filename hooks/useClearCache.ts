import useStore from '@/state';
import * as FileSystem from 'expo-file-system';
import { useState } from 'react';

export const useClearCache = () => {
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const store = useStore();

  const clearCache = async () => {
    setIsClearing(true);
    setError(null);

    try {
      // Clear conversations from store
      store.clearConversations();

      // Clear websocket messages
      store.clearMessages();

      // Clear all upload states and local files
      const conversations = Object.keys(store.conversations);
      for (const conversationId of conversations) {
        store.clearUploadState(conversationId);
      }

      // Clear any remaining temporary files in app's cache directory
      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        await FileSystem.deleteAsync(cacheDir, { idempotent: true });
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      }

    } catch (err) {
      console.error('Failed to clear cache:', err);
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