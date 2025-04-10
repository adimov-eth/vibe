import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as FileSystem from 'expo-file-system';
import * as TaskManager from 'expo-task-manager';
import { getAuthorizationHeader } from './auth';
const API_URL = process.env.EXPO_PUBLIC_API_URL;
export const BACKGROUND_UPLOAD_TASK = "BACKGROUND_UPLOAD_TASK";
const PENDING_UPLOADS_KEY = '@background_uploads';
const ID_MAP_KEY = '@local_to_server_id_map';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface PendingUpload {
  conversationId: string
  localConversationId?: string
  audioUri: string;
  audioKey: string;
  timestamp: number
  attemptCount: number
}

type LocalToServerIdMap = { [key: string]: string };

const getStoredIdMap = async (): Promise<LocalToServerIdMap> => {
    try {
        const mapStr = await AsyncStorage.getItem(ID_MAP_KEY);
        return mapStr ? JSON.parse(mapStr) : {};
    } catch (error) {
        return {};
    }
};

export const setStoredIdMap = async (idMap: LocalToServerIdMap): Promise<void> => {
    try {
        await AsyncStorage.setItem(ID_MAP_KEY, JSON.stringify(idMap));
    } catch (error) {}
};
export const getPendingUploads = async (): Promise<PendingUpload[]> => {
    try {
        const uploadsStr = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
        const uploads = uploadsStr ? JSON.parse(uploadsStr) : [];
        return uploads.map((u: any) => ({ ...u, attemptCount: u.attemptCount ?? 0 }));
    } catch (error) {
        return [];
    }
};

export const setPendingUploads = async (uploads: PendingUpload[]): Promise<void> => {
    try {
        await AsyncStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(uploads));
    } catch (error) {}
};


export const saveOrUpdatePendingUpload = async (
    uploadData: Omit<PendingUpload, 'timestamp' | 'attemptCount'> & { localConversationId?: string }
): Promise<void> => {
    const findLocalId = uploadData.localConversationId || (UUID_REGEX.test(uploadData.conversationId) ? undefined : uploadData.conversationId);
    try {
        let uploads = await getPendingUploads();
        const now = Date.now();

        const existingIndex = findLocalId ? uploads.findIndex(
            item => (item.localConversationId === findLocalId || item.conversationId === findLocalId) && item.audioKey === uploadData.audioKey
        ) : -1;
        let foundIndex = existingIndex;
        if (foundIndex === -1) {
             foundIndex = uploads.findIndex(item => item.conversationId === uploadData.conversationId && item.audioKey === uploadData.audioKey);
        }


        if (foundIndex !== -1) {
            const existingUpload = uploads[foundIndex];
            uploads[foundIndex] = {
                ...existingUpload,
                ...uploadData,
                localConversationId: findLocalId || existingUpload.localConversationId,
                timestamp: now,
                attemptCount: existingUpload.attemptCount,
            };
        } else {
            const newUpload: PendingUpload = {
                ...uploadData,
                localConversationId: findLocalId,
                timestamp: now,
                attemptCount: 0,
            };
            uploads.push(newUpload);
        }

        await setPendingUploads(uploads);
    } catch (error) {}
};


export const removePendingUpload = async (
    serverConversationId: string,
    audioKey: string,
    localToServerIds: LocalToServerIdMap
): Promise<void> => {
    try {
      let uploads = await getPendingUploads();
      const initialCount = uploads.length;

      const filteredUploads = uploads.filter(upload => {
          const isDirectMatch = upload.conversationId === serverConversationId && upload.audioKey === audioKey;
          const isMappedMatch = upload.localConversationId && localToServerIds[upload.localConversationId] === serverConversationId && upload.audioKey === audioKey;
          const isConvIdLocalMapped = !UUID_REGEX.test(upload.conversationId) && localToServerIds[upload.conversationId] === serverConversationId && upload.audioKey === audioKey;

          return !(isDirectMatch || isMappedMatch || isConvIdLocalMapped);
      });


      if (filteredUploads.length < initialCount) {
          await setPendingUploads(filteredUploads);
      } else {}
    } catch (error) {}
};


export const uploadAudioInBackground = async (
  pendingUpload: PendingUpload,
  localToServerIds: LocalToServerIdMap
): Promise<boolean> => {
    const { audioUri, conversationId: serverConversationId, audioKey, localConversationId } = pendingUpload;
    if (!UUID_REGEX.test(serverConversationId)) {
        return false;
    }
    let authHeader: string | null = null;
    try {
        authHeader = await getAuthorizationHeader();
        if (!authHeader) {
            return false;
        }
    } catch (authError) {
        return false;
    }

    try {
     const fileInfo = await FileSystem.getInfoAsync(audioUri);
     if (!fileInfo.exists) {
         await removePendingUpload(serverConversationId, audioKey, localToServerIds);
         return false;
     }
   } catch (infoError) {
        return false;
    }

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

        if (!response || response.status < 200 || response.status >= 300) {
            const errorBody = response?.body ? `: ${response.body.substring(0, 100)}` : '';
            const errorMessage = `${response?.status || 'Network Error'}: Background upload failed${errorBody}`;
            return false;
        }

        await removePendingUpload(serverConversationId, audioKey, localToServerIds);
        try {
            await FileSystem.deleteAsync(audioUri, { idempotent: true });
        } catch (deleteError) {}
        return true;
    } catch(uploadError) {
        return false;
    }
};

TaskManager.defineTask(BACKGROUND_UPLOAD_TASK, async () => {
    const taskStartTime = Date.now();
    let processedCount = 0;
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;
    let pendingUploads: PendingUpload[] = [];

    try {
        pendingUploads = await getPendingUploads();

        if (pendingUploads.length === 0) {
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        let localToServerIds: LocalToServerIdMap = {};
        try {
            localToServerIds = await getStoredIdMap();
        } catch (storeError) {}

        const uploadsToProcess = [...pendingUploads];

        for (const upload of uploadsToProcess) {
            processedCount++;
            let serverIdToUse: string | undefined = undefined;
            const originalLocalId = upload.localConversationId || (UUID_REGEX.test(upload.conversationId) ? null : upload.conversationId);

            if (UUID_REGEX.test(upload.conversationId)) {
                serverIdToUse = upload.conversationId;
            } else {
                const mappedServerId = localToServerIds[upload.conversationId];
                if (mappedServerId) {
                    serverIdToUse = mappedServerId;
                    await saveOrUpdatePendingUpload({
                       ...upload,
                       conversationId: serverIdToUse,
                       localConversationId: upload.conversationId,
                    });
                } else {
                    skippedCount++;
                    continue;
                }
            }

            if (serverIdToUse) {
                const uploadObjectWithServerId: PendingUpload = {
                    ...upload,
                    conversationId: serverIdToUse,
                    localConversationId: originalLocalId || undefined,
                };

                const success = await uploadAudioInBackground(uploadObjectWithServerId, localToServerIds);

                if (success) {
                    successCount++;
                } else {
                    failureCount++;
                    try {
                          const currentUploads = await getPendingUploads();
                          const indexToUpdate = currentUploads.findIndex(u => u.audioUri === upload.audioUri);
                          if (indexToUpdate !== -1) {
                              const currentAttemptCount = currentUploads[indexToUpdate].attemptCount || 0;
                              currentUploads[indexToUpdate].attemptCount = currentAttemptCount + 1;
                              await setPendingUploads(currentUploads);
                          }
                     } catch(e) {}
                }
            } else {
                skippedCount++;
            }
        }

        const taskEndTime = Date.now();

        if (successCount > 0) return BackgroundFetch.BackgroundFetchResult.NewData;
        if (failureCount > 0) return BackgroundFetch.BackgroundFetchResult.Failed;
        return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
        const taskEndTime = Date.now();
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

export const registerBackgroundUploadTask = async (): Promise<void> => {
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_UPLOAD_TASK);
        if (!isRegistered) {
            const intervalMinutes = 5;
            await BackgroundFetch.registerTaskAsync(BACKGROUND_UPLOAD_TASK, {
              minimumInterval: 60 * intervalMinutes,
              stopOnTerminate: false,
              startOnBoot: true,
            });
        } else {}
        const status = await BackgroundFetch.getStatusAsync();
        const statusString = status !== null ? BackgroundFetch.BackgroundFetchStatus[status] : 'Unknown (null)';
    } catch (e) {}
};