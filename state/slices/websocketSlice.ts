// state/slices/websocketSlice.ts
import { getClerkInstance } from "@clerk/clerk-expo";
import { StateCreator } from "zustand";
import { StoreState, WS_URL, WebSocketSlice } from "../types";

export const createWebSocketSlice: StateCreator<
  StoreState,
  [],
  [],
  WebSocketSlice
> = (set, get) => ({
  socket: null,
  wsMessages: [],
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectInterval: 1000,
  maxReconnectDelay: 30000,
  isConnecting: false,

  calculateBackoff: () => {
    const attempts = get().reconnectAttempts;
    const baseInterval = get().reconnectInterval;
    const maxDelay = get().maxReconnectDelay;
    const exponentialDelay = Math.min(
      Math.pow(2, attempts) * baseInterval,
      maxDelay
    );
    const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);
    return Math.floor(exponentialDelay + jitter);
  },

  connectWebSocket: async () => {
    if (get().isConnecting || get().socket?.readyState === WebSocket.CONNECTING) {
      console.log("WebSocket connection already in progress");
      return;
    }

    if (get().reconnectAttempts >= get().maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    set({ isConnecting: true });

    try {
      const token = await getClerkInstance().session?.getToken();
      if (!token) {
        console.error("No authentication token available");
        set({ isConnecting: false });
        return;
      }

      const existingSocket = get().socket;
      if (existingSocket && existingSocket.readyState !== WebSocket.CLOSED) {
        existingSocket.close();
        set({ socket: null });
      }

      const wsUrl = new URL(WS_URL);
      wsUrl.searchParams.append('token', encodeURIComponent(token));
      wsUrl.searchParams.append('version', 'v1');

      const ws = new WebSocket(wsUrl.toString());
      
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error("WebSocket connection timeout");
          ws.close();
        }
      }, 10000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log("WebSocket Connected");
        set({ 
          reconnectAttempts: 0,
          isConnecting: false 
        });
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          set((state: StoreState) => ({
            wsMessages: [...state.wsMessages.slice(-99), message],
          }));
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log(`WebSocket Closed: ${event.code} - ${event.reason}`);
        set({ 
          socket: null,
          isConnecting: false 
        });
        
        if (get().reconnectAttempts < get().maxReconnectAttempts && event.code !== 1000) {
          const backoffDelay = get().calculateBackoff();
          console.log(`Reconnecting in ${backoffDelay}ms (attempt ${get().reconnectAttempts + 1})`);
          
          setTimeout(() => {
            set((state: StoreState) => ({
              reconnectAttempts: state.reconnectAttempts + 1,
            }));
            get().connectWebSocket();
          }, backoffDelay);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket Error:", error);
      };

      set({ socket: ws });
    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
      set((state) => ({
        reconnectAttempts: state.reconnectAttempts + 1,
        isConnecting: false
      }));
    }
  },

  subscribeToConversation: (conversationId: string) => {
    const socket = get().socket;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "subscribe",
          topic: `conversation:${conversationId}`,
        })
      );
    }
  },

  unsubscribeFromConversation: (conversationId: string) => {
    const socket = get().socket;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "unsubscribe",
          topic: `conversation:${conversationId}`,
        })
      );
    }
  },

  clearMessages: () => set({ wsMessages: [] }),
});