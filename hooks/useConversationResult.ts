import { useEffect, useState } from 'react';
import useStore from '../state/index';
import type { WebSocketMessage } from '../state/types';

interface ConversationResult {
  transcript?: string;
  analysis?: string;
  status: 'processing' | 'completed' | 'error';
  error?: string;
  progress: number;
  additionalData?: {
    category?: 'mediator' | 'counselor' | 'dinner' | 'movie';
  };
}

export const useConversationResult = (conversationId: string) => {
  const [data, setData] = useState<ConversationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { 
    wsMessages, 
    socket, 
    connectWebSocket, 
    subscribeToConversation,
    unsubscribeFromConversation,
    clearMessages,
    clearUploadState,
  } = useStore();

  // Connect to WebSocket and subscribe to conversation updates
  useEffect(() => {
    let mounted = true;

    const setupWebSocket = async () => {
      try {
        if (!socket) {
          await connectWebSocket();
        }
        if (mounted) {
          subscribeToConversation(conversationId);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to connect to WebSocket'));
        }
      }
    };

    setupWebSocket();

    // Cleanup function
    return () => {
      mounted = false;
      unsubscribeFromConversation(conversationId);
      clearMessages();
    };
  }, [conversationId, socket, connectWebSocket, subscribeToConversation, unsubscribeFromConversation, clearMessages]);

  // Process WebSocket messages and handle cleanup
  useEffect(() => {
    const relevantMessages = wsMessages.filter(
      msg => msg.payload.conversationId === conversationId
    );

    if (relevantMessages.length === 0) {
      setData({
        status: 'processing',
        progress: 0
      });
      return;
    }

    const result: ConversationResult = {
      status: 'processing',
      progress: 0
    };

    // Process messages in order
    relevantMessages.forEach((msg: WebSocketMessage) => {
      switch (msg.type) {
        case 'transcript':
          result.transcript = msg.payload.content;
          result.progress = Math.min(50, Math.round((relevantMessages.length / 2) * 100));
          break;
        case 'analysis':
          result.analysis = msg.payload.content;
          result.progress = Math.min(100, 50 + Math.round((relevantMessages.length / 2) * 100));
          break;
        case 'error':
          result.status = 'error';
          result.error = msg.payload.error;
          result.progress = 100;
          // Clean up on error
          clearUploadState(conversationId);
          break;
        case 'status':
          if (msg.payload.status === 'completed') {
            result.status = 'completed';
            result.progress = 100;
            // Clean up on completion
            clearUploadState(conversationId);
          }
          break;
      }
    });

    setData(result);
    setIsLoading(false);
  }, [wsMessages, conversationId, clearUploadState]);

  // Cleanup on unmount if we haven't received a result
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
    refetch
  };
}; 