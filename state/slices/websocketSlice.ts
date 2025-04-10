import { getAuthTokens } from '@/utils/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StateCreator } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { ConversationResult, StoreState, WS_URL, WebSocketMessage } from '../types';

const MAX_WS_MESSAGES = 100;

interface WebSocketState {
  socket: WebSocket | null;
  wsMessages: WebSocketMessage[];
  conversationResults: { [key: string]: ConversationResult };
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectInterval: number;
  maxReconnectDelay: number;
  isConnecting: boolean;
}

interface WebSocketActions {
  calculateBackoff: () => number;
  connectWebSocket: () => Promise<void>;
  subscribeToConversation: (conversationId: string) => Promise<void>;
  unsubscribeFromConversation: (conversationId: string) => Promise<void>;
  clearMessages: () => void;
  getConversationResultError: (conversationId: string) => string | null
}

export type WebSocketSlice = WebSocketState & WebSocketActions;

const initialState: WebSocketState = {
  socket: null,
  wsMessages: [],
  conversationResults: {},
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectInterval: 1000,
  maxReconnectDelay: 30000,
  isConnecting: false,
};

export const createWebSocketSlice: StateCreator<
  StoreState,
  [],
  [['zustand/immer', never]],
  WebSocketSlice
> = immer((set, get) => ({
  ...initialState,

  getConversationResultError: (conversationId: string): string | null => {
    return get().conversationResults[conversationId]?.error || null;
  },

  calculateBackoff: () => {
    const state = get();
    const exponentialDelay = Math.min(
      Math.pow(2, state.reconnectAttempts) * state.reconnectInterval,
      state.maxReconnectDelay
    );
    const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);
    return Math.floor(exponentialDelay + jitter);
  },

  connectWebSocket: async () => {
    const state = get();
    if (state.isConnecting || state.socket?.readyState === WebSocket.CONNECTING) {
      return;
    }
    if (state.reconnectAttempts > state.maxReconnectAttempts)
      {}

    set((state) => {
      state.isConnecting = true;
    });

    try {
      const tokens = await getAuthTokens();
      const token = tokens.identityToken;

      if (!token) {
        set(state => { state.isConnecting = false; });
        return;
      }
      const existingSocket = state.socket;
      if (existingSocket && existingSocket.readyState !== WebSocket.CLOSED) {
        existingSocket.onopen = null;
        existingSocket.onmessage = null;
        existingSocket.onerror = null;
        existingSocket.onclose = null;
        existingSocket.close(1000, 'Client initiated reconnect');
        set((state) => { state.socket = null; });
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const connectionUrl = WS_URL;
      const ws = new WebSocket(connectionUrl);
      let connectionTimeout: NodeJS.Timeout | null = null;

      set((state) => { state.socket = ws; });

      ws.onopen = async () => {
        if (connectionTimeout) clearTimeout(connectionTimeout);

        set((state) => {
          state.reconnectAttempts = 0;
          state.isConnecting = false;
        });

        try {
          const authMessage = JSON.stringify({ type: 'auth', token: token });
          ws.send(authMessage);
        } catch (sendError) {
          ws.close(4001, 'Failed to send auth');
          return;
        }

        try {
          const storedTopics = await AsyncStorage.getItem('websocket_subscriptions');
          if (storedTopics) {
            const topics = JSON.parse(storedTopics) as string[];
            topics.forEach(topic => {
              const conversationId = topic.startsWith('conversation:') ? topic.split(':')[1] : null;
              if (conversationId) {
                get().subscribeToConversation(conversationId);
              } else {}
            });
          }
        } catch (e: unknown) {}
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          const messageType = message.type;

          if (__DEV__) {
              if (!['pong'].includes(messageType)) {}
          }

          set((state) => {
            let conversationId: string | undefined = undefined;

            if (message.type === 'transcript' || message.type === 'analysis' || message.type === 'status' || message.type === 'audio') {
              conversationId = message.payload.conversationId;
            } else if (message.type === 'error' && message.payload.conversationId) {
              conversationId = message.payload.conversationId;
            }
            
            if (conversationId) {
               if (!state.conversationResults[conversationId]) {
                 state.conversationResults[conversationId] = { status: 'processing', progress: 0 };
               }
               const currentResult = state.conversationResults[conversationId];

               switch (message.type) {
               case 'transcript':
                 currentResult.transcript = message.payload.content;
                 currentResult.progress = Math.max(currentResult.progress, 50);
                 break;
               case 'analysis':
                 currentResult.analysis = message.payload.content;
                 currentResult.progress = 100;
                 currentResult.status = 'completed';
                 break;
               case 'status':
                 if (message.payload.status === 'conversation_completed' || message.payload.status === 'completed') {
                   currentResult.status = 'completed';
                   currentResult.progress = 100;
                   if (message.payload.gptResponse) {
                     currentResult.analysis = message.payload.gptResponse;
                   }
                   if (message.payload.error) { currentResult.status = 'error'; 
                      currentResult.error = message.payload.error;
                   }
                 } else if (message.payload.status === 'error') {
                   currentResult.status = 'error';
                   currentResult.error = message.payload.error || 'Unknown processing error';
                   currentResult.progress = 100;
                 } else {}
                 break;
               case 'audio':
                 if (message.payload.status === 'transcribed') {
                   currentResult.progress = Math.max(currentResult.progress, 40);
                 } else if (message.payload.status === 'failed') {
                   currentResult.status = 'error';
                   currentResult.error = 'Audio processing failed';
                   currentResult.progress = 100;
                 }
                 break;
               case 'error':
                 currentResult.status = 'error';
                 currentResult.error = message.payload.error || 'Unknown error';
                 currentResult.progress = 100;
                 break;
               }
            } else
              if (message.type === 'error') {}

            if (messageType === 'auth_success')
              {} else
              if (messageType === 'subscription_confirmed') {}
            
            state.wsMessages.push(message);
            if (state.wsMessages.length > MAX_WS_MESSAGES) {
              state.wsMessages = state.wsMessages.slice(-MAX_WS_MESSAGES);
            }
          });
        } catch (error) {}
      };

      ws.onclose = (event) => {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        if (get().socket !== ws) {
          return;
        }

        let shouldReconnect = true;
        let isAuthError = false;

        switch (event.code) {
            case 1000:
            case 1001:
              shouldReconnect = false;
              break;
            case 1008:
            case 4001:
            case 4002:
            case 4003:
            case 4008:
              shouldReconnect = false;
              isAuthError = true;
              break;
             case 1006:
               break;
            default:
        }

        set((state) => {
          state.socket = null;
          state.isConnecting = false;
          if (isAuthError) {}
        });

        if (shouldReconnect) {
          const reconnectDelay = get().calculateBackoff();
          setTimeout(() => {
             if (!get().socket && !get().isConnecting) {
                 set((state) => { state.reconnectAttempts += 1; });
                 get().connectWebSocket();
             } else
               {}
          }, reconnectDelay);
        }
      };

      ws.onerror = (event: Event | { message?: string }) => {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        const errorMessage = (event as { message?: string }).message || 'WebSocket Error Event occurred';
        if (get().socket !== ws) {
          return;
        }

        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
           ws.close(1011, "WebSocket error occurred");
        }
        set((state) => { state.isConnecting = false; });
      };

      connectionTimeout = setTimeout(() => {
        connectionTimeout = null;
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close(4008, 'Connection timeout');
        }
      }, 15000);
    } catch (error) {
      set((state) => {
        state.isConnecting = false;
        if (state.socket && state.socket.readyState !== WebSocket.CLOSED) {
             state.socket.close(1011, "Initial connection setup error");
        }
        state.socket = null;
      });

      const backoffDelay = get().calculateBackoff();
      setTimeout(() => {
         if (!get().socket && !get().isConnecting) {
             set((state) => { state.reconnectAttempts += 1; });
             get().connectWebSocket();
         } else
           {}
      }, backoffDelay);
    }
  },

  subscribeToConversation: async (conversationId: string) => {
    const state = get();
    const socket = state.socket;
    const topic = `conversation:${conversationId}`;

    try {
      const storedTopics = await AsyncStorage.getItem('websocket_subscriptions');
      let topics: string[] = storedTopics ? JSON.parse(storedTopics) : [];
      if (!topics.includes(topic)) {
        topics.push(topic);
        await AsyncStorage.setItem('websocket_subscriptions', JSON.stringify(topics));
      }
    } catch (e: unknown) {}

    if (socket?.readyState === WebSocket.OPEN) {
      try {
        const subscribeMessage = JSON.stringify({
          type: 'subscribe',
          payload: { topic: topic }
        });
        socket.send(subscribeMessage);
      } catch (e) {}
    } else {
      const readyStateMap: { [key: number]: string } = {
        [WebSocket.CONNECTING]: 'CONNECTING',
        [WebSocket.OPEN]: 'OPEN',
        [WebSocket.CLOSING]: 'CLOSING',
        [WebSocket.CLOSED]: 'CLOSED',
      };
      const socketState = socket ? (readyStateMap[socket.readyState] ?? 'UNKNOWN') : 'null';
      if (!socket || socket.readyState === WebSocket.CLOSED) {
        get().connectWebSocket();
      }
    }
  },

  unsubscribeFromConversation: async (conversationId: string) => {
    const state = get();
    const socket = state.socket;
    const topic = `conversation:${conversationId}`;

    try {
      const storedTopics = await AsyncStorage.getItem('websocket_subscriptions');
      if (storedTopics) {
        let topics: string[] = JSON.parse(storedTopics);
        const initialLength = topics.length;
        topics = topics.filter(t => t !== topic);
        if (topics.length < initialLength) {
          await AsyncStorage.setItem('websocket_subscriptions', JSON.stringify(topics));
        }
      }
    } catch (e: unknown) {}

    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(
          JSON.stringify({
            type: 'unsubscribe',
            topic: topic,
          })
        );
      } catch (e) {}
    } else {}
  },

  clearMessages: () => {
    set((state) => {
      state.wsMessages = [];
    });
  },

}));