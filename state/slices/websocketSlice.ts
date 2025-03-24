import { StateCreator } from 'zustand';
import { StoreState, WS_URL, WebSocketSlice } from '../types';

export const createWebSocketSlice: StateCreator<
  StoreState,
  [],
  [],
  WebSocketSlice
> = (set, get) => ({
  socket: null,
  wsMessages: [],

  connectWebSocket: async () => {
    const token = get().token || await get().fetchToken();
    if (!token) throw new Error('No authentication token');

    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onopen = () => {
      console.log('WebSocket Connected');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      set((state: StoreState) => ({ wsMessages: [...state.wsMessages, message] }));
    };

    ws.onclose = () => {
      console.log('WebSocket Closed');
      set({ socket: null });
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      set({ socket: null });
    };

    set({ socket: ws });
  },

  subscribeToConversation: (conversationId: string) => {
    const socket = get().socket;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: 'subscribe',
          topic: `conversation:${conversationId}`,
        })
      );
    }
  },
}); 