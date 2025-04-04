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
      console.log(`[ConversationSlice:createConversation] Creating conversation. LocalID=${localConversationId}, Mode=${mode}, Type=${recordingType}`);
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
          console.error(`[ConversationSlice:createConversation] Failed to create. Status: ${response.status}, Body: ${errorBody}`);
          throw new Error(`Failed to create conversation (Status: ${response.status})`);
      }

      const data = await response.json();
      const serverConversationId = data.conversation?.id || data.conversationId;

      if (!serverConversationId) {
           console.error(`[ConversationSlice:createConversation] Server response missing conversation ID. Response:`, data);
           throw new Error("Server did not return a conversation ID");
      }
       console.log(`[ConversationSlice:createConversation] Conversation created successfully. ServerID=${serverConversationId}`);


      // Add conversation to local state immediately
      set((state) => ({
        conversations: {
          ...state.conversations,
          [serverConversationId]: {
            id: serverConversationId,
            status: "waiting", // Initial status
            mode,
            recordingType,
          } as Conversation, // Cast to Conversation type
        },
      }));

      // Set the mapping - this will trigger processing of any pending uploads for this local ID
      await get().setLocalToServerId(localConversationId, serverConversationId);

      return serverConversationId; // Return the server ID
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
            console.error(`[ConversationSlice:getConversation] Failed to fetch ${conversationId}. Status: ${response.status}, Body: ${errorBody}`);
            throw new Error(`Failed to fetch conversation (Status: ${response.status})`);
        }

        const data = await response.json();
        // Assuming server returns the full conversation object in `data.conversation`
        const conversationData = data.conversation as Conversation;
        if (!conversationData || !conversationData.id) {
             console.error(`[ConversationSlice:getConversation] Server response missing conversation data for ${conversationId}. Response:`, data);
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
        throw error; // Re-throw the original error
      }
    },
  };
};