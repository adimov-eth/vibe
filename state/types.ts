export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profileImageUrl: string;
}

export interface Conversation {
  id: string;
  status: "waiting" | "active" | "completed";
  mode: "mediator" | "counselor";
  recordingType: "separate" | "live";
}

export interface UploadProgress {
  [key: string]: number; // uploadId = `${serverConversationId}_${audioKey}`
}

export type UploadResult =
  | { success: true; url: string }
  | { success: false; error: string; audioUri: string; conversationId: string; audioKey: string };

export interface SubscriptionStatus {
  active: boolean;
  plan: string;
  expiresAt: string;
}

export interface UsageStats {
  totalConversations: number;
  totalMinutes: number;
  remainingMinutes: number;
}

export interface AuthSlice {
  token: string | null;
  userProfile: User | null;
  authLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  fetchToken: () => Promise<string | null>;
  getUserProfile: () => Promise<User | null>;
  logout: () => Promise<void>;
}

export interface ConversationSlice {
  conversations: Record<string, Conversation>;
  conversationLoading: Record<string, boolean>;
  createConversation: (
    mode: string,
    recordingType: "separate" | "live",
    localConversationId: string
  ) => Promise<string>;
  getConversation: (conversationId: string) => Promise<Conversation>;
}

export interface SubscriptionSlice {
  subscriptionStatus: SubscriptionStatus | null;
  usageStats: UsageStats | null;
  verifySubscription: (receiptData: string) => Promise<any>;
  checkSubscriptionStatus: () => Promise<any>;
  getUsageStats: () => Promise<any>;
}

export interface WebSocketSlice {
  socket: WebSocket | null;
  wsMessages: any[];
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectInterval: number;
  maxReconnectDelay: number;
  calculateBackoff: () => number;
  connectWebSocket: () => Promise<void>;
  subscribeToConversation: (conversationId: string) => void;
  clearMessages: () => void;
}

export interface PendingUpload {
  localConversationId: string;
  audioUri: string;
  audioKey: string; // e.g., "1" or "2" to distinguish audio files
}

export interface UploadSlice {
  uploadProgress: UploadProgress;
  uploadResults: { [uploadId: string]: UploadResult };
  pendingUploads: PendingUpload[];
  localToServerIds: { [localConversationId: string]: string };
  uploadAudio: (audioUri: string, conversationId: string, audioKey: string) => Promise<void>;
  addPendingUpload: (localConversationId: string, audioUri: string, audioKey: string) => void;
  processPendingUploads: (localConversationId: string) => void;
  setLocalToServerId: (localId: string, serverId: string) => void;
  clearUploadState: (conversationId: string) => void;
}

export type StoreState = AuthSlice &
  ConversationSlice &
  UploadSlice &
  SubscriptionSlice &
  WebSocketSlice;

export interface StoreActions {
  fetchToken: () => Promise<string | null>;
  getUserProfile: () => Promise<User | null>;
}

export const API_BASE_URL = "https://v.bkk.lol/api/v1";
export const WS_URL = "ws://v.bkk.lol/ws";