import { StateCreator } from 'zustand';
import { API_BASE_URL, Conversation, ConversationSlice, StoreState } from '../types';

export const createConversationSlice: StateCreator<
  StoreState,
  [],
  [],
  ConversationSlice
> = (set, get) => ({
  conversations: {},

  createConversation: async (mode: string, recordingType: string) => {
    const token = get().token || await get().fetchToken();
    if (!token) throw new Error('No authentication token');

    const response = await fetch(`${API_BASE_URL}/conversations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode, recordingType }),
    });

    const data = await response.json();
    set((state: StoreState) => ({
      conversations: {
        ...state.conversations,
        [data.conversationId]: { 
          id: data.conversationId, 
          status: 'waiting',
          mode,
          recordingType,
        } as Conversation,
      },
    }));
    return data.conversationId;
  },

  getConversation: async (conversationId: string) => {
    const token = get().token || await get().fetchToken();
    if (!token) throw new Error('No authentication token');

    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    
    set((state: StoreState) => ({
      conversations: { ...state.conversations, [conversationId]: data as Conversation },
    }));
    return data as Conversation;
  },
}); 