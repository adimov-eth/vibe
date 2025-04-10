import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useStore from '../state/index';
import type { StoreState } from '../state/types';

export const useConversationResult = (conversationId: string) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { 
    data, 
    subscribeToConversation, 
    unsubscribeFromConversation, 
    getConversationResultError 
  } = useStore(
    useShallow((state: StoreState) => ({
        data: state.conversationResults[conversationId] || null,
        subscribeToConversation: state.subscribeToConversation,
        unsubscribeFromConversation: state.unsubscribeFromConversation,
        getConversationResultError: state.getConversationResultError,
    }))
  );

  useEffect(() => {
    subscribeToConversation(conversationId);

    return () => {
      unsubscribeFromConversation(conversationId);
    };
  }, [conversationId, subscribeToConversation, unsubscribeFromConversation]);

  useEffect(() => {
    const convError = getConversationResultError(conversationId);
    const hasData = !!data;
    const isProcessing = hasData && data.status === 'processing'; 

    if (convError) {
      setError(convError);
      setIsLoading(false);
    } else if (hasData && !isProcessing) {
      setError(data.error || null);
      setIsLoading(false);
    } else {
      setError(null);
      setIsLoading(true);
    }
  }, [data, conversationId, getConversationResultError]);

  const refetch = () => {
    setIsLoading(true);
    setError(null);
    unsubscribeFromConversation(conversationId);
    subscribeToConversation(conversationId);
  };

  return {
    data,
    isLoading, 
    error,
    refetch,
  };
}; 