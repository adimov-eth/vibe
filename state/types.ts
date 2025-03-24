// User types
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profileImageUrl: string;
}

// Conversation types
export interface Conversation {
  id: string;
  status: 'waiting' | 'active' | 'completed';
  mode: 'mediator' | 'counselor';
  recordingType: 'separate' | 'live';
}

// Upload types
export interface UploadProgress {
  [key: string]: number;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

// Subscription types
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

// Store types
export interface AuthSlice {
  token: string | null;
  userProfile: User | null;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  fetchToken: () => Promise<string | null>;
  getUserProfile: () => Promise<User | null>;
  logout: () => Promise<void>;
}

export interface ConversationSlice {
  conversations: Record<string, Conversation>;
  createConversation: (mode: string, recordingType: string) => Promise<string>;
  getConversation: (conversationId: string) => Promise<Conversation>;
}

export interface UploadSlice {
  uploadProgress: UploadProgress;
  uploadResults: Record<string, UploadResult>;
  uploadAudio: (audioUri: string, conversationId: string) => void;
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
  connectWebSocket: () => Promise<void>;
  subscribeToConversation: (conversationId: string) => void;
}

// Combined store type
export type StoreState = AuthSlice & 
  ConversationSlice & 
  UploadSlice & 
  SubscriptionSlice & 
  WebSocketSlice;

export interface StoreActions {
  fetchToken: () => Promise<string | null>;
  getUserProfile: () => Promise<User | null>;
}

// API Configuration
export const API_BASE_URL = 'https://your-server-domain/api/v1';
export const WS_URL = 'ws://your-server-domain/ws'; 