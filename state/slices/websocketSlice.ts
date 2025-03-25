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
  reconnectInterval: 1000, // Base interval (1 second)
  maxReconnectDelay: 30000, // Maximum delay cap (30 seconds)

  calculateBackoff: () => {
    const attempts = get().reconnectAttempts;
    const baseInterval = get().reconnectInterval;
    const maxDelay = get().maxReconnectDelay;
    
    // Calculate exponential delay: 2^attempts * baseInterval
    const exponentialDelay = Math.min(
      Math.pow(2, attempts) * baseInterval,
      maxDelay
    );
    
    // Add random jitter (±20%)
    const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);
    return Math.floor(exponentialDelay + jitter);
  },

  connectWebSocket: async () => {
    if (get().reconnectAttempts >= get().maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    try {
      const token = await getClerkInstance().session?.getToken();
      if (!token) {
        console.error("No authentication token available");
        return;
      }

      const ws = new WebSocket(`${WS_URL}?token=${token}`);

      ws.onopen = () => {
        console.log("WebSocket Connected");
        set({ reconnectAttempts: 0 }); // Reset on success
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        set((state: StoreState) => ({
          wsMessages: [...state.wsMessages.slice(-99), message],
        }));
      };

      ws.onclose = () => {
        console.log("WebSocket Closed");
        set({ socket: null });
        
        // Only attempt reconnection if we haven't reached max attempts
        if (get().reconnectAttempts < get().maxReconnectAttempts) {
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
        ws.close(); // Trigger onclose for reconnection
      };

      set({ socket: ws });
    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
      set((state) => ({
        reconnectAttempts: state.reconnectAttempts + 1,
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