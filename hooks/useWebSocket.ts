import { useEffect } from 'react';
import useStore from '../state/index';

export const useWebSocket = () => {
  const { socket, wsMessages, connectWebSocket, subscribeToConversation, clearMessages } =
    useStore();

  useEffect(() => {
    if (!socket) connectWebSocket().catch(() => {});
  }, [socket, connectWebSocket]);

  return { socket, messages: wsMessages, subscribeToConversation, clearMessages };
};