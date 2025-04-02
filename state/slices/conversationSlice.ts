import { getAuthorizationHeader } from "@/utils/auth";
import { StateCreator } from "zustand";
import { Conversation, ConversationSlice, StoreState } from "../types";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const createConversationSlice: StateCreator<
  StoreState,
  [],
  [],
  ConversationSlice
> = (set, get) => {
  const getAuthToken = async () => {
    const authHeader = await getAuthorizationHeader();
    if (!authHeader) throw new Error("No authentication token");
    return authHeader;
  };

  return {
    conversations: {},
    conversationLoading: {},

    clearConversations: () => {
      set(() => ({
        conversations: {},
        conversationLoading: {},
      }));
    },

    createConversation: async (
      mode: string,
      recordingType: "separate" | "live",
      localConversationId: string
    ) => {
      const authHeader = await getAuthToken();

      const response = await fetch(`${API_URL}/conversations`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode, recordingType }),
      });

      if (!response.ok) throw new Error("Failed to create conversation");

      const data = await response.json();
      const serverConversationId = data.conversation?.id || data.conversationId;

      set((state) => ({
        conversations: {
          ...state.conversations,
          [serverConversationId]: {
            id: serverConversationId,
            status: "waiting",
            mode,
            recordingType,
          } as Conversation,
        },
        localToServerIds: {
          ...state.localToServerIds,
          [localConversationId]: serverConversationId,
        },
      }));

      get().processPendingUploads(localConversationId);
      return serverConversationId;
    },

    getConversation: async (conversationId: string) => {
      set((state) => ({
        conversationLoading: { ...state.conversationLoading, [conversationId]: true },
      }));

      try {
        const authHeader = await getAuthToken();

        const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
          headers: { Authorization: authHeader },
        });

        if (!response.ok) throw new Error("Failed to fetch conversation");

        const data = await response.json();
        set((state) => ({
          conversations: { ...state.conversations, [conversationId]: data as Conversation },
          conversationLoading: { ...state.conversationLoading, [conversationId]: false },
        }));
        return data as Conversation;
      } catch (error) {
        set((state) => ({
          conversationLoading: { ...state.conversationLoading, [conversationId]: false },
        }));
        throw error;
      }
    },
  };
};