import * as FileSystem from 'expo-file-system';
import { getAuthorizationHeader } from './auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface UploadOptions {
  audioUri: string;
  conversationId: string;
  audioKey: string;
  onProgress: (progress: number) => void;
}

export interface UploadFileResult {
   success: boolean;
   url?: string
   error?: string
   statusCode?: number
}


export const uploadFile = async ({
    audioUri,
    conversationId,
    audioKey,
    onProgress,
}: UploadOptions): Promise<UploadFileResult> => {
    const authHeader = await getAuthorizationHeader();
    if (!authHeader) {
         return { success: false, error: '401: Authentication token missing', statusCode: 401 };
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
            },
            (progress) => {
                if (progress.totalBytesExpectedToSend > 0) {
                    const percentComplete = Math.round( (progress.totalBytesSent / progress.totalBytesExpectedToSend) * 100
                    );
                    onProgress(percentComplete);
                }
            }
        );

        const response = await uploadTask.uploadAsync();

        if (response && (response.status === 200 || response.status === 201)) {
            const result = JSON.parse(response.body);
            return { success: true, url: result.url, statusCode: response.status };
        } else {
            const errorBody = response?.body ? `: ${response.body.substring(0, 100)}` : '';
            return {
                success: false,
                error: `${response?.status || 'Network Error'}: Upload failed${errorBody}`,
                statusCode: response?.status
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
};