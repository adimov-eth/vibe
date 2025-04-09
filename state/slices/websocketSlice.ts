// state/slices/websocketSlice.ts
import { getAuthTokens } from '@/utils/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StateCreator } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { ConversationResult, StoreState, WS_URL, WebSocketMessage } from '../types';

const MAX_WS_MESSAGES = 100; // Keep the last 100 messages

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
  getConversationResultError: (conversationId: string) => string | null;
  // Optional: Add a prune action if more complex logic is needed later
  // pruneMessages: (criteria: PruningCriteria) => void;
}

export type WebSocketSlice = WebSocketState & WebSocketActions;

const initialState: WebSocketState = {
  socket: null,
  wsMessages: [],
  conversationResults: {},
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

  getConversationResultError: (conversationId: string): string | null => {
    // Selector function to get error from the results map
    return get().conversationResults[conversationId]?.error || null;
  },

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
      console.log('[WS Client] connectWebSocket: Connection attempt already in progress.');
      return;
    }
    console.log('[WS Client] connectWebSocket: Starting connection attempt.');

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
      const token = tokens.identityToken;

      if (!token) {
           console.error("[WS Client] connectWebSocket: No identity token found. Cannot authenticate WebSocket.");
           set(state => { state.isConnecting = false; });
           return;
      }
      console.log(`[WS Client] connectWebSocket: Using identity token starting with ${token.substring(0, 8)}...`);

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

      const connectionUrl = WS_URL;
      console.log('[WS Client] connectWebSocket: Attempting to connect to:', connectionUrl);
      const ws = new WebSocket(connectionUrl);
      let connectionTimeout: NodeJS.Timeout | null = null;

      // Set socket immediately
      set((state) => { state.socket = ws; });
      console.log('[WS Client] connectWebSocket: WebSocket instance created.');

      ws.onopen = async () => {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        console.log('[WS Client] WebSocket Event: onopen - Connected');

        set((state) => {
          state.reconnectAttempts = 0;
          state.isConnecting = false;
        });

        // Send authentication message
        try {
           const authMessage = JSON.stringify({ type: 'auth', token: token });
           console.log('[WS Client] WebSocket Event: onopen - Sending authentication message...');
          ws.send(authMessage);
           console.log('[WS Client] WebSocket Event: onopen - Authentication message sent.');
        } catch (sendError) {
           console.error('[WS Client] WebSocket Event: onopen - Failed to send auth message:', sendError);
           ws.close(4001, 'Failed to send auth');
           return;
        }

        // Restore subscriptions
        try {
          const storedTopics = await AsyncStorage.getItem('websocket_subscriptions');
           console.log(`[WS Client] WebSocket Event: onopen - Checking stored subscriptions: ${storedTopics ? 'Found' : 'None found'}`);
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
          console.error('[WS Client] WebSocket Event: onopen - Error restoring subscriptions:', e instanceof Error ? e.message : e);
        }
      };

      ws.onmessage = (event) => {
         console.log('[WS Client] WebSocket Event: onmessage - Received data.');
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          const messageType = message.type;

           console.log(`[WS Client] WebSocket Event: onmessage - Parsed message type: ${messageType}`);

          if (__DEV__) {
              if (!['pong'].includes(messageType)) {
                  console.log('[WS Client] WebSocket Event: onmessage - Message Payload:', JSON.stringify(message, null, 2));
              }
          }

          // --- Process and Update Conversation Results State --- 
          set((state) => {
            let conversationId: string | undefined = undefined;

            // Extract conversationId based on message type
            if (message.type === 'transcript' || message.type === 'analysis' || message.type === 'status' || message.type === 'audio') {
              conversationId = message.payload.conversationId;
            } else if (message.type === 'error' && message.payload.conversationId) {
              conversationId = message.payload.conversationId;
            }
            
            // If the message is relevant to a specific conversation
            if (conversationId) {
               // Initialize result if it doesn't exist
               if (!state.conversationResults[conversationId]) {
                 state.conversationResults[conversationId] = { status: 'processing', progress: 0 };
               }
               const currentResult = state.conversationResults[conversationId];

               // Update based on message type
               switch (message.type) {
                 case 'transcript':
                   currentResult.transcript = message.payload.content;
                   currentResult.progress = Math.max(currentResult.progress, 50); // Example progress
                   break;
                 case 'analysis':
                   currentResult.analysis = message.payload.content;
                   currentResult.progress = 100;
                   currentResult.status = 'completed'; // Analysis implies completion
                   break;
                 case 'status':
                   if (message.payload.status === 'conversation_completed' || message.payload.status === 'completed') {
                     currentResult.status = 'completed';
                     currentResult.progress = 100;
                     if (message.payload.gptResponse) {
                       currentResult.analysis = message.payload.gptResponse; // Populate analysis if provided
                     }
                     if (message.payload.error) { // Handle potential error within completed status
                        currentResult.status = 'error'; 
                        currentResult.error = message.payload.error;
                     }
                   } else if (message.payload.status === 'error') {
                     currentResult.status = 'error';
                     currentResult.error = message.payload.error || 'Unknown processing error';
                     currentResult.progress = 100;
                   } else {
                      // Other intermediate statuses could update progress
                      // currentResult.status = 'processing'; // Ensure status stays processing if not completed/error
                   }
                   break;
                 case 'audio':
                   if (message.payload.status === 'transcribed') {
                     currentResult.progress = Math.max(currentResult.progress, 40); // Example progress
                   } else if (message.payload.status === 'failed') {
                     currentResult.status = 'error';
                     currentResult.error = 'Audio processing failed';
                     currentResult.progress = 100;
                   }
                   break;
                  case 'error': // Handle general errors associated with a conversation ID
                    currentResult.status = 'error';
                    currentResult.error = message.payload.error || 'Unknown error';
                    currentResult.progress = 100;
                    break;
               }
            } else if (message.type === 'error') {
              // Handle global errors (not tied to a specific conversationId)
              console.error("[WS Client] Received global error:", message.payload.error);
              // Optionally set a global error state in the store
              // state.globalError = message.payload.error;
            }

            // Handle non-conversation-specific messages (auth, pong, etc.)
            if (messageType === 'auth_success') {
              console.log(`[WS Client] WebSocket Event: onmessage - Authentication successful. User ID: ${message.userId}`);
            } else if (messageType === 'subscription_confirmed') {
              console.log(`[WS Client] WebSocket Event: onmessage - Subscription confirmed for topic: ${message.payload.topic}`);
            }
            
            // Keep limited raw message history (optional, could be removed)
            state.wsMessages.push(message);
            if (state.wsMessages.length > MAX_WS_MESSAGES) {
              state.wsMessages = state.wsMessages.slice(-MAX_WS_MESSAGES);
            }
          });
          // --- End Processing Logic ---

        } catch (error) {
          console.error('[WS Client] WebSocket Event: onmessage - Failed to parse or process message:', error, 'Raw data:', event.data);
        }
      };

      ws.onclose = (event) => {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        console.log(`[WS Client] WebSocket Event: onclose - Code ${event.code}, Reason: ${event.reason || 'No reason'}`);

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

      ws.onerror = (event: Event | { message?: string }) => {
         if (connectionTimeout) clearTimeout(connectionTimeout);
         // Try to get a message, otherwise log generic
         const errorMessage = (event as { message?: string }).message || 'WebSocket Error Event occurred';
         console.error(`[WS Client] WebSocket Event: onerror - ${errorMessage}`, event);

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
        connectionTimeout = null;
        if (ws.readyState === WebSocket.CONNECTING) {
           console.warn('[WS Client] connectWebSocket: Connection timed out after 15s. Closing socket.');
           ws.close(4008, 'Connection timeout');
        }
      }, 15000);

    } catch (error) {
      console.error('[WS Client] connectWebSocket: Failed to initiate connection:', error);
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
     console.log(`[WS Client] subscribeToConversation: Requesting subscription for conversation: ${conversationId}`);
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
        console.log(`[WS Client] subscribeToConversation: Stored subscription request for ${topic}`);
      }
    } catch (e: unknown) {
      console.error('[WS Client] subscribeToConversation: Failed to store subscription request:', e instanceof Error ? e.message : e);
    }
    // --- End manage stored subscriptions ---

    if (socket?.readyState === WebSocket.OPEN) {
      try {
         const subscribeMessage = JSON.stringify({ type: 'subscribe', topic: topic });
         console.log(`[WS Client] subscribeToConversation: Sending subscribe message for ${topic}`);
        socket.send(subscribeMessage);
         console.log(`[WS Client] subscribeToConversation: Subscribe message sent for ${topic}`);
      } catch (e) {
         console.error(`[WS Client] subscribeToConversation: Failed to send subscribe message for ${topic}:`, e);
      }
    } else {
       // Map readyState number to string name
       const readyStateMap: { [key: number]: string } = {
         [WebSocket.CONNECTING]: 'CONNECTING',
         [WebSocket.OPEN]: 'OPEN',
         [WebSocket.CLOSING]: 'CLOSING',
         [WebSocket.CLOSED]: 'CLOSED',
       };
       const socketState = socket ? (readyStateMap[socket.readyState] ?? 'UNKNOWN') : 'null';
       console.log(`[WS Client] subscribeToConversation: Socket not open (state: ${socketState}). Subscription to ${topic} will be sent upon connection/reconnection.`);
      if (!socket || socket.readyState === WebSocket.CLOSED) {
         console.log("[WS Client] subscribeToConversation: Socket is closed, attempting to reconnect to send subscription.");
         get().connectWebSocket();
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