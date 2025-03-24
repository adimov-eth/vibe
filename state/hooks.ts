import { useCallback, useEffect } from "react";
import useStore from "./index";

export const useAuth = () => {
  const store = useStore();
  const login = useCallback(async () => {
    try {
      store.setError(null);
      const token = await store.fetchToken();
      if (token) await store.getUserProfile();
      return token;
    } catch (error) {
      store.setError(error instanceof Error ? error.message : "Login failed");
      return null;
    }
  }, [store]);
  const logout = useCallback(async () => {
    await store.logout();
  }, [store]);
  return {
    token: store.token,
    user: store.userProfile,
    authLoading: store.authLoading,
    error: store.error,
    login,
    logout,
  };
};

export const useConversation = (conversationId: string) => {
  const { conversations, conversationLoading, getConversation, error } = useStore();
  const conversation = conversations[conversationId];
  const isLoading = conversationLoading[conversationId] || false;

  useEffect(() => {
    if (!conversation && conversationId && !isLoading) {
      getConversation(conversationId).catch(() => {}); // Handle error in component if needed
    }
  }, [conversation, conversationId, isLoading, getConversation]);

  return { conversation, isLoading, isError: !!error };
};

export const useUserProfile = () => {
  const { userProfile, getUserProfile, authLoading, error } = useStore();

  useEffect(() => {
    if (!userProfile && !authLoading) {
      getUserProfile().catch(() => {}); // Handle error in component if needed
    }
  }, [userProfile, authLoading, getUserProfile]);

  return { user: userProfile, isLoading: authLoading, isError: !!error };
};

export const useWebSocket = () => {
  const { socket, wsMessages, connectWebSocket, subscribeToConversation, clearMessages } =
    useStore();

  useEffect(() => {
    if (!socket) {
      connectWebSocket().catch(() => {}); // Handle error in component if needed
    }
  }, [socket, connectWebSocket]);

  return { socket, messages: wsMessages, subscribeToConversation, clearMessages };
};