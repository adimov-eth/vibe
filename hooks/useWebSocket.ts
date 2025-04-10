import { useEffect } from 'react';
import useStore from '../state/index';

export const useWebSocket = () => {
  const { socket, wsMessages, connectWebSocket, subscribeToConversation, clearMessages } =
    useStore();

  useEffect(() => {
    const socketState = socket ? socket.readyState : 'null';
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      connectWebSocket().catch((err) => {});
    }
  }, [socket, connectWebSocket]);

  return { socket, messages: wsMessages, subscribeToConversation, clearMessages };
};