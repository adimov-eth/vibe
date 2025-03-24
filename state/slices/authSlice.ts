import { getClerkInstance } from "@clerk/clerk-expo";
import { StateCreator } from "zustand";
import { API_BASE_URL, AuthSlice, StoreState, User } from "../types";

export const createAuthSlice: StateCreator<StoreState, [], [], AuthSlice> = (
  set,
  get
) => ({
  token: null,
  userProfile: null,
  isLoading: false,
  error: null,

  setError: (error: string | null) => set({ error }),

  fetchToken: async () => {
    try {
      set({ isLoading: true, error: null });
      const clerkInstance = getClerkInstance();
      const token = (await clerkInstance.session?.getToken()) ?? null;
      set({ token, isLoading: false });
      return token;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return null;
    }
  },

  getUserProfile: async () => {
    try {
      set({ isLoading: true, error: null });
      const token = get().token || (await get().fetchToken());
      if (!token) throw new Error("No authentication token");

      const response = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch user profile");

      const data = await response.json();
      if (data.user) {
        set({ userProfile: data.user as User, isLoading: false });
        return data.user as User;
      }

      set({ isLoading: false });
      return null;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return null;
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true, error: null });
      const clerkInstance = getClerkInstance();
      await clerkInstance.signOut();
      // Close WebSocket on logout
      const socket = get().socket;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.close();
      }
      set({ token: null, userProfile: null, socket: null, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },
});