// state/slices/websocketSlice.ts
import { getClerkInstance } from "@clerk/clerk-expo";
import { StateCreator } from "zustand";
import { immer } from "zustand/middleware/immer";
import { StoreState, WS_URL, WebSocketMessage } from "../types";

// Initial state type
interface WebSocketState {
  socket: WebSocket | null;
  wsMessages: WebSocketMessage[];
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectInterval: number;
  maxReconnectDelay: number;
  isConnecting: boolean;
}

// Actions type
interface WebSocketActions {
  calculateBackoff: () => number;
  connectWebSocket: () => Promise<void>;
  subscribeToConversation: (conversationId: string) => void;
  unsubscribeFromConversation: (conversationId: string) => void;
  clearMessages: () => void;
}

// Combined slice type
export type WebSocketSlice = WebSocketState & WebSocketActions;

// Initial state
const initialState: WebSocketState = {
  socket: null,
  wsMessages: [],
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectInterval: 1000,
  maxReconnectDelay: 30000,
  isConnecting: false,
};

export const createWebSocketSlice: StateCreator<
  StoreState,
  [],
  [["zustand/immer", never]],
  WebSocketSlice
> = immer((set, get) => ({
  ...initialState,

  calculateBackoff: () => {
    const state = get() as WebSocketSlice;
    const exponentialDelay = Math.min(
      Math.pow(2, state.reconnectAttempts) * state.reconnectInterval,
      state.maxReconnectDelay
    );
    const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);
    return Math.floor(exponentialDelay + jitter);
  },

  connectWebSocket: async () => {
    const state = get() as WebSocketSlice;
    if (state.isConnecting || state.socket?.readyState === WebSocket.CONNECTING) {
      console.log("WebSocket connection already in progress");
      return;
    }

    if (state.reconnectAttempts >= state.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    set((state) => { state.isConnecting = true });

    try {
      const token = await getClerkInstance().session?.getToken();
      if (!token) {
        console.error("No authentication token available");
        set((state) => { state.isConnecting = false });
        return;
      }

      const existingSocket = state.socket;
      if (existingSocket && existingSocket.readyState !== WebSocket.CLOSED) {
        existingSocket.close();
        set((state) => { state.socket = null });
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
        set((state) => {
          state.reconnectAttempts = 0;
          state.isConnecting = false;
          state.socket = ws;
        });
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          set((state) => {
            state.wsMessages = [...state.wsMessages.slice(-99), message];
          });
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log(`WebSocket Closed: ${event.code} - ${event.reason}`);
        set((state) => {
          state.socket = null;
          state.isConnecting = false;
        });
        
        const currentState = get() as WebSocketSlice;
        if (currentState.reconnectAttempts < currentState.maxReconnectAttempts && event.code !== 1000) {
          const backoffDelay = currentState.calculateBackoff();
          console.log(`Reconnecting in ${backoffDelay}ms (attempt ${currentState.reconnectAttempts + 1})`);
          
          setTimeout(() => {
            set((state) => { state.reconnectAttempts += 1 });
            (get() as WebSocketSlice).connectWebSocket();
          }, backoffDelay);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket Error:", error);
      };

    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
      set((state) => {
        state.reconnectAttempts += 1;
        state.isConnecting = false;
      });
    }
  },

  subscribeToConversation: (conversationId: string) => {
    const state = get() as WebSocketSlice;
    const socket = state.socket;
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
    const state = get() as WebSocketSlice;
    const socket = state.socket;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "unsubscribe",
          topic: `conversation:${conversationId}`,
        })
      );
    }
  },

  clearMessages: () => set((state) => { state.wsMessages = [] }),
}));