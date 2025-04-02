import * as FileSystem from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import useStore from '../state/index';
import type { AnalysisMessage, AudioMessage, ErrorMessage, StatusMessage, TranscriptMessage, WebSocketMessage } from '../state/types';

interface ConversationResult {
  transcript?: string;
  analysis?: string;
  status: 'processing' | 'completed' | 'error';
  error?: string;
  progress: number;
}

interface ConversationPayload {
  id: string;
}

interface BaseMessagePayload {
  conversationId?: string;
  conversation?: ConversationPayload;
}

export const useConversationResult = (conversationId: string) => {
  console.log(`[useConversationResult Hook] Initializing hook for conversation: ${conversationId}`);
  const [data, setData] = useState<ConversationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Move all refs to the top level
  const isSubscribed = useRef(false);
  const lastAttemptTime = useRef(0);
  const mounted = useRef(true);
  const checkInterval = useRef<NodeJS.Timeout | null>(null);

  const {
    wsMessages,
    socket,
    connectWebSocket,
    subscribeToConversation,
    unsubscribeFromConversation,
    clearMessages,
    clearUploadState,
    uploadResults,
  } = useStore();

  // Function to clean up local audio files associated with this conversation
  const cleanupLocalFiles = async () => {
    if (!conversationId) return;
    console.log(`[useConversationResult Hook] Cleaning up local files for conversation: ${conversationId}`);
    const results = useStore.getState().uploadResults; // Get current results state
    const urisToDelete = new Set<string>();

    // Iterate through upload results to find relevant URIs
    Object.keys(results).forEach(uploadId => {
        // Check if uploadId belongs to this conversation (starts with serverId_)
        if (uploadId.startsWith(`${conversationId}_`)) {
            const result = results[uploadId];
            if (result?.audioUri) {
                urisToDelete.add(result.audioUri);
            }
        }
        // Also check if the result has a matching localConversationId (if applicable)
        // This might be redundant if serverId logic works, but adds robustness
        // const localId = getStore.getState().localToServerIds[conversationId]; // Need inverse map or check localId property
        // if (result?.localConversationId === conversationId && result?.audioUri) {
        //    urisToDelete.add(result.audioUri);
        // }
    });

    if (urisToDelete.size === 0) {
        console.log(`[useConversationResult Hook] No local audio URIs found in results state for ${conversationId} to delete.`);
        return;
    }

    console.log(`[useConversationResult Hook] Attempting to delete ${urisToDelete.size} local files for ${conversationId}:`, Array.from(urisToDelete));
    for (const uri of urisToDelete) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
          console.log(`[useConversationResult Hook] Deleted local file: ${uri}`);
        } else {
           console.log(`[useConversationResult Hook] Local file already deleted or missing: ${uri}`);
        }
      } catch (deleteError) {
        console.error(`[useConversationResult Hook] Failed to delete local file ${uri}:`, deleteError);
      }
    }
     console.log(`[useConversationResult Hook] Finished local file cleanup attempt for ${conversationId}.`);

  };

  useEffect(() => {
    console.log(`[useConversationResult Hook] useEffect running for conversation: ${conversationId}`);
    mounted.current = true;

    // Attempt to subscribe and return success status
    const attemptSubscription = () => {
      if (!mounted.current) return false;
      
      // Only log in development
      if (__DEV__) {
        console.log('Attempting to subscribe to conversation:', conversationId);
      }
      
      try {
        subscribeToConversation(conversationId);
        isSubscribed.current = true;
        lastAttemptTime.current = Date.now();
        return true;
      } catch (error) {
        console.error('Error subscribing to conversation:', error);
        return false;
      }
    };

    // Set up a periodic health check to ensure subscription is active
    const startConnectionHealthCheck = () => {
      // Clear any existing interval
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
      
      // Check connection every 15 seconds
      checkInterval.current = setInterval(() => {
        if (!mounted.current) return;
        
        const now = Date.now();
        const timeSinceLastAttempt = now - lastAttemptTime.current;
        
        // If socket is closed and we haven't attempted in the last 10 seconds
        if ((!socket || socket.readyState !== WebSocket.OPEN) && timeSinceLastAttempt > 10000) {
          if (__DEV__) {
            console.log('Health check: WebSocket connection needs refresh');
          }
          connectWebSocket();
          lastAttemptTime.current = now;
        }
        
        // If we've been connected for at least 5 seconds but haven't received messages
        // for this conversation, try re-subscribing
        if (socket?.readyState === WebSocket.OPEN && timeSinceLastAttempt > 5000) {
          const hasRelevantMessages = wsMessages.some(msg => {
            // Check if the message type is one that contains conversation info before accessing payload
            if ('payload' in msg && msg.payload) {
              const payload = msg.payload as BaseMessagePayload; // Safe cast after check
              return payload.conversationId === conversationId ||
                     (payload.conversation?.id === conversationId);
            }
            return false; // Ignore messages without a payload relevant here
          });
          
          if (!hasRelevantMessages && isSubscribed.current) {
            if (__DEV__) {
              console.log('Health check: No messages received, re-subscribing');
            }
            subscribeToConversation(conversationId);
            lastAttemptTime.current = now;
          }
        }
      }, 15000);
    };

    // Initialize the connection and subscription
    const initialize = async () => {
       console.log(`[useConversationResult Hook] initialize() called for conversation: ${conversationId}`);
      try {
        if (__DEV__) {
          console.log('[useConversationResult Hook] Initializing WebSocket via attemptSubscription for conversation:', conversationId);
        }
        attemptSubscription();
        startConnectionHealthCheck();
      } catch (err) {
        console.error('[useConversationResult Hook] initialize() error:', err);
        if (mounted.current) {
          setError(err instanceof Error ? err : new Error('Failed to connect to WebSocket'));
          setIsLoading(false);
        }
      }
    };

    console.log(`[useConversationResult Hook] Calling initialize() for conversation: ${conversationId}`);
    initialize();

    return () => {
      if (__DEV__) {
        console.log('Cleaning up WebSocket for conversation:', conversationId);
      }
      mounted.current = false;
      isSubscribed.current = false;
      
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
      
      unsubscribeFromConversation(conversationId);
    };
  }, [conversationId, socket, connectWebSocket, subscribeToConversation, unsubscribeFromConversation]);

  useEffect(() => {
    if (!mounted.current) return;
    
    // Only log in development mode
    if (__DEV__) {
      console.log('Processing messages for conversation:', conversationId);
      console.log('wsMessages:', wsMessages);
    }
    
    try {
      // Filter messages for this conversation, but be more flexible with conversationId location
      const relevantMessages = wsMessages.filter(
        (msg) => {
          try {
            // Handle different message types according to their specific structure
            if (msg.type === 'transcript' || msg.type === 'analysis' || msg.type === 'status') {
              return msg.payload.conversationId === conversationId;
            } else if (msg.type === 'audio') {
              return msg.payload.conversationId === conversationId;
            } else if (msg.type === 'error') {
              // Include error messages that might be related to this conversation
              return !msg.payload.conversationId || msg.payload.conversationId === conversationId;
            }
            
            // Filter out connection, subscription and pong messages
            return false;
          } catch (e) {
            console.error('Error filtering message:', e);
            return false;
          }
        }
      );
    
      if (__DEV__) {
        console.log(`Found ${relevantMessages.length} relevant messages for conversation ${conversationId}`);
      }

      if (relevantMessages.length === 0) {
        if (mounted.current) {
          setData({
            status: 'processing',
            progress: 0,
          });
          setIsLoading(true);
        }
        return;
      }

    const result: ConversationResult = {
      status: 'processing',
      progress: 0,
    };

    relevantMessages.forEach((msg: WebSocketMessage) => {
      if (__DEV__) {
        console.log('Processing message:', msg.type);
      }
      
      // Process each message type based on the specific payload structure
      switch (msg.type) {
        case 'transcript':
          // Transcript messages contain the raw transcription
          const transcriptMsg = msg as TranscriptMessage;
          result.transcript = transcriptMsg.payload.content;
          result.progress = 50;
          break;
          
        case 'analysis':
          // Analysis messages contain the GPT analysis
          const analysisMsg = msg as AnalysisMessage;
          result.analysis = analysisMsg.payload.content;
          result.progress = 100;
          break;
          
        case 'error':
          // Error messages indicate something went wrong
          const errorMsg = msg as ErrorMessage;
          result.status = 'error';
          result.error = errorMsg.payload.error;
          result.progress = 100;
          clearUploadState(conversationId);
          break;
          
        case 'status':
          // Status messages indicate conversation state changes
          const statusMsg = msg as StatusMessage;
          
          if (statusMsg.payload.status === 'conversation_completed' || 
              statusMsg.payload.status === 'completed') {
            // Conversation is fully processed
            result.status = 'completed';
            
            // Use gptResponse from the status message if available
            if (statusMsg.payload.gptResponse) {
              result.analysis = statusMsg.payload.gptResponse;
            }
            
            result.progress = 100;
            clearUploadState(conversationId);
          } else if (statusMsg.payload.status === 'error') {
            // Status can also indicate an error
            result.status = 'error';
            result.error = statusMsg.payload.error || 'Unknown error occurred';
            result.progress = 100;
            clearUploadState(conversationId);
          }
          break;
          
        case 'audio':
          // Audio processing status updates
          const audioMsg = msg as AudioMessage;
          if (audioMsg.payload.status === 'transcribed') {
            // Audio transcription complete - update progress
            result.progress = Math.max(result.progress, 40);
          } else if (audioMsg.payload.status === 'failed') {
            // Audio processing failed
            result.status = 'error';
            result.error = 'Audio processing failed';
            result.progress = 100;
            clearUploadState(conversationId);
          }
          break;
      }
    });

      if (mounted.current) {
        setData(result);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error processing WebSocket messages:', err);
      if (mounted.current) {
        setError(err instanceof Error ? err : new Error('Error processing messages'));
        setIsLoading(false);
      }
    }
  }, [wsMessages, conversationId, clearUploadState]);

  useEffect(() => {
    return () => {
      if (data?.status === 'processing') {
        clearUploadState(conversationId);
      }
    };
  }, [conversationId, data?.status, clearUploadState]);

  const refetch = async () => {
    setIsLoading(true);
    setError(null);
    clearMessages();
    subscribeToConversation(conversationId);
  };

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}; 