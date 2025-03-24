import { StateCreator } from "zustand";
import { API_BASE_URL, StoreState, SubscriptionSlice, SubscriptionStatus, UsageStats } from "../types";

export const createSubscriptionSlice: StateCreator<
  StoreState,
  [],
  [],
  SubscriptionSlice
> = (set, get) => ({
  subscriptionStatus: null,
  usageStats: null,

  verifySubscription: async (receiptData: string) => {
    const token = get().token || (await get().fetchToken());
    if (!token) throw new Error("No authentication token");

    const response = await fetch(`${API_BASE_URL}/subscriptions/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ receiptData }),
    });

    if (!response.ok) throw new Error("Failed to verify subscription");

    const data = await response.json();
    set({ subscriptionStatus: data.subscription as SubscriptionStatus });
    return data;
  },

  checkSubscriptionStatus: async () => {
    const token = get().token || (await get().fetchToken());
    if (!token) throw new Error("No authentication token");

    const response = await fetch(`${API_BASE_URL}/subscriptions/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error("Failed to check subscription status");

    const data = await response.json();
    if (data.subscription) {
      set({ subscriptionStatus: data.subscription as SubscriptionStatus });
    }
    return data;
  },

  getUsageStats: async () => {
    const token = get().token || (await get().fetchToken());
    if (!token) throw new Error("No authentication token");

    const response = await fetch(`${API_BASE_URL}/usage/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error("Failed to fetch usage stats");

    const data = await response.json();
    if (data.usage) {
      set({ usageStats: data.usage as UsageStats });
    }
    return data;
  },
});