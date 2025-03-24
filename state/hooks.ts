import { useCallback } from "react";
import useStore from "./index";

export const useAuth = () => {
  const store = useStore();

  const login = useCallback(async () => {
    try {
      store.setError(null);
      const token = await store.fetchToken();
      if (token) {
        await store.getUserProfile();
      }
      return token;
    } catch (error) {
      store.setError((error as Error).message);
      return null;
    }
  }, [store]);

  const logout = useCallback(async () => {
    await store.logout();
  }, [store]);

  return {
    token: store.token,
    user: store.userProfile,
    isLoading: store.isLoading,
    error: store.error,
    login,
    logout,
  };
};

// Access conversation directly from store
export const useConversation = (conversationId: string) => {
  const { conversations, getConversation, isLoading, error } = useStore();
  const conversation = conversations[conversationId];

  // Fetch conversation if not in state
  useCallback(() => {
    if (!conversation && conversationId) {
      getConversation(conversationId);
    }
  }, [conversation, conversationId, getConversation]);

  return {
    conversation,
    isLoading,
    isError: error,
  };
};

// Access user profile directly from store
export const useUserProfile = () => {
  const { userProfile, getUserProfile, isLoading, error } = useStore();

  // Fetch profile if not in state
  useCallback(() => {
    if (!userProfile) {
      getUserProfile();
    }
  }, [userProfile, getUserProfile]);

  return {
    user: userProfile,
    isLoading,
    isError: error,
  };
};