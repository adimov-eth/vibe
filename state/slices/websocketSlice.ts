// state/slices/websocketSlice.ts
import { getAuthTokens } from '@/utils/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StateCreator } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { StoreState, WS_URL, WebSocketMessage } from '../types';

const MAX_WS_MESSAGES = 100; // Keep the last 100 messages

interface WebSocketState {
  socket: WebSocket | null;
  wsMessages: WebSocketMessage[];
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
  // Optional: Add a prune action if more complex logic is needed later
  // pruneMessages: (criteria: PruningCriteria) => void;
}

export type WebSocketSlice = WebSocketState & WebSocketActions;

const initialState: WebSocketState = {
  socket: null,
  wsMessages: [],
  reconnectAttempts: 0,
  maxReconnectAttempts: 5, // Keep trying after 5, just with max delay
  reconnectInterval: 1000, // Initial delay 1s
  maxReconnectDelay: 30000, // Max delay 30s
  isConnecting: false,
};

export const createWebSocketSlice: StateCreator<
  StoreState,
  [],
  [['zustand/immer', never]],
  WebSocketSlice
> = immer((set, get) => ({
  ...initialState,

  calculateBackoff: () => {
    const state = get();
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      Math.pow(2, state.reconnectAttempts) * state.reconnectInterval,
      state.maxReconnectDelay
    );
    // Jitter: +/- 10% of the delay
    const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);
    return Math.floor(exponentialDelay + jitter);
  },

  connectWebSocket: async () => {
    const state = get();
    // Prevent multiple concurrent connection attempts
    if (state.isConnecting || state.socket?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket connection attempt already in progress.');
      return;
    }

    // Resetting attempts slightly differently:
    // If max attempts reached, keep the attempt count high for max delay,
    // but allow retries indefinitely.
    if (state.reconnectAttempts > state.maxReconnectAttempts) {
        console.log(`Max reconnect attempts exceeded, continuing with max delay (${state.maxReconnectDelay}ms).`);
        // Keep reconnectAttempts high to maintain max backoff
    }

    set((state) => {
      state.isConnecting = true;
    });

    try {
      const tokens = await getAuthTokens();
      // Use identityToken for WS auth as per server logic in `websocket/auth.ts`
      const token = tokens.identityToken;

      if (!token) {
           console.error("No identity token found. Cannot authenticate WebSocket.");
           // Don't attempt to connect without a token. Let the UI handle sign-in.
           set(state => { state.isConnecting = false; });
           // Optionally trigger sign-out flow or show error message
           return;
      }

      // Ensure previous socket is cleaned up
      const existingSocket = state.socket;
      if (existingSocket && existingSocket.readyState !== WebSocket.CLOSED) {
        console.log("Closing existing WebSocket before reconnecting.");
        // Remove listeners before closing to avoid triggering reconnect logic unnecessarily
        existingSocket.onopen = null;
        existingSocket.onmessage = null;
        existingSocket.onerror = null;
        existingSocket.onclose = null;
        existingSocket.close(1000, 'Client initiated reconnect');
        set((state) => { state.socket = null; });
        // Short delay to allow the close event to potentially propagate if needed
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const connectionUrl = WS_URL; // Assuming WS_URL is correctly defined
      console.log('Connecting WebSocket to:', connectionUrl);
      const ws = new WebSocket(connectionUrl);
      let connectionTimeout: NodeJS.Timeout | null = null;

      // Set socket immediately in state to prevent race conditions
      set((state) => { state.socket = ws; });

      ws.onopen = async () => {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        console.log('WebSocket Connected');

        set((state) => {
          state.reconnectAttempts = 0; // Reset attempts on successful connection
          state.isConnecting = false;
          // state.socket = ws; // Already set
        });

        // Send authentication message
        try {
          ws.send(JSON.stringify({ type: 'auth', token: token }));
          console.log('Sent authentication token via WebSocket message.');
        } catch (sendError) {
           console.error('Failed to send auth message:', sendError);
           ws.close(4001, 'Failed to send auth'); // Close with specific code if auth send fails
           return;
        }

        // Restore subscriptions after successful authentication
        try {
          const storedTopics = await AsyncStorage.getItem('websocket_subscriptions');
          if (storedTopics) {
            const topics = JSON.parse(storedTopics) as string[];
            console.log(`Restoring ${topics.length} subscriptions...`);
            topics.forEach(topic => {
              // Extract conversationId - adjust if topic format changes
              const conversationId = topic.startsWith('conversation:') ? topic.split(':')[1] : null;
              if (conversationId) {
                // Use the slice's internal method to resubscribe
                get().subscribeToConversation(conversationId);
              } else {
                 console.warn(`Skipping restoration of invalid topic format: ${topic}`);
              }
            });
          }
        } catch (e: unknown) {
          console.error('Error restoring subscriptions:', e instanceof Error ? e.message : e);
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;

          if (__DEV__) {
              // More selective logging for noisy messages
              if (!['pong'].includes(message.type)) {
                  console.log('WebSocket message received:', JSON.stringify(message, null, 2));
              }
          }

          // Handle specific message types if needed (e.g., forced logout)
          if (message.type === 'error' && message.payload?.error?.includes('Authentication failed')) {
             console.error("WebSocket authentication failed on server:", message.payload.error);
             // Optionally trigger logout or show specific error to user
          }

          // --- Simplified Message Storage ---
          set((state) => {
            // Append new message
            state.wsMessages.push(message);
            // Enforce max length by slicing
            if (state.wsMessages.length > MAX_WS_MESSAGES) {
              state.wsMessages = state.wsMessages.slice(-MAX_WS_MESSAGES);
            }
          });
          // --- End Simplified Message Storage ---

        } catch (error) {
          console.error('Failed to parse WebSocket message:', error, 'Raw data:', event.data);
        }
      };

      ws.onclose = (event) => {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        console.log(`WebSocket Closed: Code ${event.code}, Reason: ${event.reason || 'No reason'}`);

        // Avoid scheduling reconnect if this socket instance is already replaced
        if (get().socket !== ws) {
             console.log("Stale WebSocket closed event ignored.");
             return;
        }

        let shouldReconnect = true;
        let isAuthError = false;

        switch (event.code) {
            case 1000: // Normal closure
            case 1001: // Going away
                shouldReconnect = false;
                console.log("WebSocket closed normally or going away. Won't automatically reconnect.");
                break;
            case 1008: // Policy violation (could be auth)
            case 4001: // App-specific Auth Failed
            case 4002: // Invalid Auth Message
            case 4003: // Internal Auth Context Error
            case 4008: // Auth Timeout
                shouldReconnect = false; // Don't automatically reconnect on auth errors
                isAuthError = true;
                console.error(`Authentication related error (Code: ${event.code}). Reconnection stopped. Reason: ${event.reason}`);
                // Consider notifying the user or triggering sign-out
                break;
             case 1006: // Abnormal closure
                 console.warn("WebSocket closed abnormally (1006). Will attempt reconnect.");
                 break;
            default:
                console.log(`WebSocket closed unexpectedly (Code: ${event.code}). Will attempt reconnect. Reason: ${event.reason}`);
        }

        set((state) => {
          state.socket = null; // Clear the socket instance
          state.isConnecting = false;
          if (isAuthError) {
             // Optionally add auth error state to the store
             // state.authError = `Authentication failed (Code: ${event.code})`;
          }
        });

        if (shouldReconnect) {
          const reconnectDelay = get().calculateBackoff();
          console.log(
            `Attempting to reconnect WebSocket in ${Math.round(reconnectDelay / 1000)}s (attempt ${get().reconnectAttempts + 1})`
          );
          setTimeout(() => {
             // Check if still disconnected before attempting
             if (!get().socket && !get().isConnecting) {
                 set((state) => { state.reconnectAttempts += 1; });
                 get().connectWebSocket();
             } else {
                  console.log("Reconnect cancelled: WebSocket is already connected or connecting.");
             }
          }, reconnectDelay);
        }
      };

      ws.onerror = (event: Event) => {
         if (connectionTimeout) clearTimeout(connectionTimeout);
         // Log a generic error message as 'Event' doesn't guarantee a 'message' property
         console.error('WebSocket Error Event occurred:', event); // Log the event itself or a generic message

         // Avoid scheduling reconnect if this socket instance is already replaced
         if (get().socket !== ws) {
             console.log("Stale WebSocket error event ignored.");
             return;
         }

         // Ensure the socket is closed after an error, triggering the onclose logic
         if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close(1011, "WebSocket error occurred"); // 1011: Internal Error
         }
         // The onclose handler will manage state updates and reconnection logic
         set((state) => { state.isConnecting = false; });
      };

      // Connection Timeout handler
      connectionTimeout = setTimeout(() => {
        connectionTimeout = null; // Clear the timeout handle
        if (ws.readyState === WebSocket.CONNECTING) {
           console.warn('WebSocket connection timed out. Closing socket.');
           ws.close(4008, 'Connection timeout'); // Use a specific code for timeout
        }
        // If already open or closed, do nothing.
      }, 15000); // 15 seconds connection timeout

    } catch (error) {
      console.error('Failed to initiate WebSocket connection:', error);
      set((state) => {
        state.isConnecting = false;
        // Ensure socket state is cleared on initial setup error
        if (state.socket && state.socket.readyState !== WebSocket.CLOSED) {
             state.socket.close(1011, "Initial connection setup error");
        }
        state.socket = null;
      });

      // Schedule a reconnect attempt even if the initial setup fails
      const backoffDelay = get().calculateBackoff();
      console.log(`Scheduling reconnect after connection initiation error in ${Math.round(backoffDelay/1000)}s`);
      setTimeout(() => {
         // Check if still disconnected before attempting
         if (!get().socket && !get().isConnecting) {
             set((state) => { state.reconnectAttempts += 1; });
             get().connectWebSocket();
         } else {
              console.log("Reconnect cancelled: WebSocket is already connected or connecting.");
         }
      }, backoffDelay);
    }
  },

  subscribeToConversation: async (conversationId: string) => {
    const state = get();
    const socket = state.socket;
    const topic = `conversation:${conversationId}`;

    // --- Manage stored subscriptions ---
    try {
      const storedTopics = await AsyncStorage.getItem('websocket_subscriptions');
      let topics: string[] = storedTopics ? JSON.parse(storedTopics) : [];
      if (!topics.includes(topic)) {
        topics.push(topic);
        await AsyncStorage.setItem('websocket_subscriptions', JSON.stringify(topics));
        console.log(`Stored subscription request for ${topic}`);
      }
    } catch (e: unknown) {
      console.error('Failed to store subscription request:', e instanceof Error ? e.message : e);
    }
    // --- End manage stored subscriptions ---

    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(
          JSON.stringify({
            type: 'subscribe',
            topic: topic,
          })
        );
        console.log(`Sent subscription request for ${topic}`);
      } catch (e) {
         console.error(`Failed to send subscribe message for ${topic}:`, e);
         // Optionally: queue the subscription request for later retry if send fails
      }
    } else {
      console.log(`Socket not open, subscription to ${topic} will be sent automatically upon connection/reconnection.`);
      // Ensure connection attempt if socket is closed or null
      if (!socket || socket.readyState === WebSocket.CLOSED) {
         console.log("Socket is closed, attempting to reconnect to send subscription.");
         get().connectWebSocket(); // Attempt to connect if not already connecting
      }
    }
  },

  unsubscribeFromConversation: async (conversationId: string) => {
    const state = get();
    const socket = state.socket;
    const topic = `conversation:${conversationId}`;

    // --- Manage stored subscriptions ---
    try {
      const storedTopics = await AsyncStorage.getItem('websocket_subscriptions');
      if (storedTopics) {
        let topics: string[] = JSON.parse(storedTopics);
        const initialLength = topics.length;
        topics = topics.filter(t => t !== topic);
        if (topics.length < initialLength) {
             await AsyncStorage.setItem('websocket_subscriptions', JSON.stringify(topics));
             console.log(`Removed stored subscription request for ${topic}`);
        }
      }
    } catch (e: unknown) {
      console.error('Failed to remove stored subscription request:', e instanceof Error ? e.message : e);
    }
     // --- End manage stored subscriptions ---

    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(
          JSON.stringify({
            type: 'unsubscribe',
            topic: topic,
          })
        );
        console.log(`Sent unsubscribe request for ${topic}`);
      } catch (e) {
         console.error(`Failed to send unsubscribe message for ${topic}:`, e);
      }
    } else {
       console.log(`Socket not open, cannot send unsubscribe for ${topic}. Stored request removed.`);
    }
  },

  clearMessages: () => {
    set((state) => {
      state.wsMessages = [];
    });
    console.log("WebSocket message history cleared.");
  },

  // Example of a more complex pruning action (optional)
  // pruneMessages: (criteria) => {
  //   set(state => {
  //     state.wsMessages = state.wsMessages.filter(msg => {
  //       // Apply criteria (e.g., age, type)
  //       return true; // Replace with actual filtering logic
  //     });
  //   });
  // },

}));