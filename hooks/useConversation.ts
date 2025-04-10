import { useEffect, useState } from "react";
import { useShallow } from 'zustand/react/shallow';
import useStore from "../state/index";
import type { Conversation, StoreState } from "../state/types";

interface ConversationSelectorResult {
  conversation: Conversation | undefined;
  isLoading: boolean;
}

export const useConversation = (conversationId: string) => {
  const [error, setError] = useState<Error | null>(null);

  const { conversation, isLoading, getConversation } = useStore(
    useShallow((state: StoreState) => ({
      conversation: state.conversations[conversationId],
      isLoading: state.conversationLoading[conversationId] ?? false,
      getConversation: state.getConversation,
    }))
  );

  useEffect(() => {
    if (!conversation && conversationId && !isLoading) {
        if (!error) {
             getConversation(conversationId).catch((err) => {
               setError(err);
             });
        }
    }
  }, [conversation, conversationId, isLoading, getConversation, error]);

  return { conversation, isLoading, isError: !!error };
}; 