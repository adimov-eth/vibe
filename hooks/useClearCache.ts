import useStore from '@/state';
import { getPendingUploads, setPendingUploads } from '@/utils/background-upload';
import * as FileSystem from 'expo-file-system';
import { useCallback, useState } from 'react';

const clearZustandState = () => {
  useStore.getState().clearConversations();
  useStore.getState().clearMessages();
  const conversations = Object.keys(useStore.getState().conversations);
  for (const conversationId of conversations) {
    useStore.getState().clearUploadState(conversationId);
  }
  useStore.setState({ uploadProgress: {}, uploadResults: {} });
};

const clearUploadArtifacts = async () => {
  const uploadResults = { ...useStore.getState().uploadResults };
  let deletedFilesCount = 0;
  const urisToDelete = Object.values(uploadResults)
    .map(result => result?.audioUri)
    .filter((uri): uri is string => !!uri);

  if (urisToDelete.length === 0) {
    return;
  }

  const deletePromises = urisToDelete.map(async (uri) => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        return true;
      }
    } catch (deleteError) {}
    return false;
  });

  const results = await Promise.allSettled(deletePromises);
  deletedFilesCount = results.filter(r => r.status === 'fulfilled' && r.value).length;

  useStore.setState({ uploadResults: {} });
};


const clearPendingUploadsStorage = async () => {
  const pending = await getPendingUploads();
  if (pending.length > 0) {
    await setPendingUploads([]);
  } else {}
};

const clearExpoCacheDirectory = async () => {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    return;
  }

  try {
    const items = await FileSystem.readDirectoryAsync(cacheDir);
    if (items.length === 0) {
      return;
    }

    let deletedCount = 0;
    const deletePromises = items.map(async (item) => {
      const itemPath = `${cacheDir}${item}`;
      try {
        await FileSystem.deleteAsync(itemPath, { idempotent: true });
        return true;
      } catch (itemDeleteError) {
        return false;
      }
    });

    const results = await Promise.allSettled(deletePromises);
    deletedCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
  } catch (readDirError) {
    const errorMsg = readDirError instanceof Error ? readDirError.message : String(readDirError);
  }
};

export const useClearCache = () => {
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearCache = useCallback(async () => {
    setIsClearing(true);
    setError(null);

    try {
      clearZustandState();
      await clearUploadArtifacts();
      await clearPendingUploadsStorage();
      await clearExpoCacheDirectory();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError('Failed to clear essential cache data. Please try again.');
    } finally {
      setIsClearing(false);
    }
  }, []);

  return {
    clearCache,
    isClearing,
    error
  };
}; 