import { StateCreator } from "zustand";
import { API_BASE_URL, StoreState, UploadResult, UploadSlice } from "../types";

export const createUploadSlice: StateCreator<StoreState, [], [], UploadSlice> = (
  set,
  get
) => ({
  uploadProgress: {},
  uploadResults: {},

  uploadAudio: async (audioUri: string, conversationId: string) => {
    const token = get().token || (await get().fetchToken());
    if (!token) throw new Error("No authentication token");

    const formData = new FormData();
    formData.append("audio", {
      uri: audioUri,
      type: "audio/m4a",
      name: "recording.m4a",
    } as any);
    formData.append("conversationId", conversationId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/audio`, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        set((state: StoreState) => ({
          uploadProgress: {
            ...state.uploadProgress,
            [conversationId]: percentComplete,
          },
        }));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        const result = JSON.parse(xhr.responseText);
        set((state: StoreState) => ({
          uploadResults: {
            ...state.uploadResults,
            [conversationId]: result as UploadResult,
          },
          uploadProgress: { ...state.uploadProgress, [conversationId]: 100 },
        }));
      } else {
        set((state: StoreState) => ({
          uploadResults: {
            ...state.uploadResults,
            [conversationId]: {
              success: false,
              error: `Upload failed: ${xhr.statusText}`,
            } as UploadResult,
          },
        }));
      }
    };

    xhr.onerror = () => {
      set((state: StoreState) => ({
        uploadResults: {
          ...state.uploadResults,
          [conversationId]: { success: false, error: "Network error" } as UploadResult,
        },
      }));
    };

    xhr.send(formData);
  },
});