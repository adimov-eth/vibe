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
    ): Promise<string> => {
      const authHeader = await getAuthToken();

      const response = await fetch(`${API_URL}/conversations`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode, recordingType }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to create conversation (Status: ${response.status})`);
      }

      const data = await response.json();
      const serverConversationId = data.conversation?.id || data.conversationId;

      if (!serverConversationId) {
        throw new Error("Server did not return a conversation ID");
      }
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
      }));

      await get().setLocalToServerId(localConversationId, serverConversationId);

      return serverConversationId;
    },

    getConversation: async (conversationId: string): Promise<Conversation> => {
      set((state) => ({
        conversationLoading: { ...state.conversationLoading, [conversationId]: true },
      }));

      try {
        const authHeader = await getAuthToken();

        const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
          headers: { Authorization: authHeader },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Failed to fetch conversation (Status: ${response.status})`);
        }

        const data = await response.json();
        const conversationData = data.conversation as Conversation;
        if (!conversationData || !conversationData.id) {
          throw new Error("Invalid conversation data received from server");
        }

        set((state) => ({
          conversations: { ...state.conversations, [conversationId]: conversationData },
          conversationLoading: { ...state.conversationLoading, [conversationId]: false },
        }));
        return conversationData;
      } catch (error) {
        set((state) => ({
          conversationLoading: { ...state.conversationLoading, [conversationId]: false },
        }));
        throw error;
      }
    },
  };
};