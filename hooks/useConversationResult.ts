import { useEffect, useState } from 'react';
import useStore from '../state/index';
import type { ConversationResult } from '../state/types';

// REMOVED Placeholder type
// interface ConversationResultsMap {
//  [key: string]: ConversationResult;
// }

export const useConversationResult = (conversationId: string) => {
  console.log(`[useConversationResult Hook] Initializing for conversation: ${conversationId}`);

  // State for this hook
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get necessary functions and state from Zustand
  const { 
    conversationResults, 
    subscribeToConversation, 
    unsubscribeFromConversation, 
    getConversationResultError 
  } = useStore();

  // Get the specific result data for this conversation
  const data: ConversationResult | null = conversationResults?.[conversationId] || null;

  // Subscribe on mount and unsubscribe on unmount
  useEffect(() => {
    console.log(`[useConversationResult Hook] Subscribing to ${conversationId}`);
    subscribeToConversation(conversationId);

    return () => {
      console.log(`[useConversationResult Hook] Unsubscribing from ${conversationId}`);
      unsubscribeFromConversation(conversationId);
    };
  }, [conversationId, subscribeToConversation, unsubscribeFromConversation]);

  // Update loading and error state based on Zustand store
  useEffect(() => {
    const convError = getConversationResultError(conversationId); // Get specific error
    const hasData = !!data;
    // Check for status property existence before accessing it
    const isProcessing = hasData && data.status === 'processing'; 

    if (convError) {
      setError(convError);
      setIsLoading(false);
    } else if (hasData && !isProcessing) {
      // Completed or errored state from data
      // Check for error property existence
      setError(data.error || null);
      setIsLoading(false);
    } else {
      // Still processing or no data yet
      setError(null);
      setIsLoading(true);
    }
  }, [data, conversationId, getConversationResultError]);

  // Refetch might involve clearing local state and letting useEffect re-subscribe/fetch
  // Or trigger a specific action in the store if needed.
  const refetch = () => {
    console.log(`[useConversationResult Hook] Refetch requested for ${conversationId}`);
    setIsLoading(true);
    setError(null);
    // Re-trigger subscription effect
    unsubscribeFromConversation(conversationId);
    subscribeToConversation(conversationId);
  };

  return {
    data,       // Directly return the processed data from the store
    isLoading, 
    error,
    refetch,
  };
}; 