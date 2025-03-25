import { getClerkInstance } from '@clerk/clerk-expo';
import { Platform } from 'react-native';
import {
  endConnection,
  finishTransaction,
  getSubscriptions,
  initConnection,
  Purchase,
  PurchaseError,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestSubscription,
  SubscriptionAndroid,
  SubscriptionIOS
} from 'react-native-iap';
import { StateCreator } from "zustand";
import { API_BASE_URL, StoreState, SubscriptionSlice, UsageStats } from "../types";

export interface SubscriptionProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  subscriptionOfferDetails?: {
    offerToken: string;
  }[];
}

export const SUBSCRIPTION_SKUS = {
  MONTHLY: 'vibecheck.subscription.monthly',
  YEARLY: 'vibecheck.subscription.yearly',
} as const;

export const createSubscriptionSlice: StateCreator<
  StoreState,
  [],
  [],
  SubscriptionSlice
> = (set, get) => {
  let purchaseUpdateSubscription: { remove: () => void } | null = null;
  let purchaseErrorSubscription: { remove: () => void } | null = null;

  const handlePurchaseUpdate = async (purchase: Purchase) => {
    const receipt = purchase.transactionReceipt;
    if (receipt) {
      try {
        await finishTransaction({ purchase, isConsumable: false });
        await get().checkSubscriptionStatus();
      } catch (err) {
        console.error('Error processing purchase:', err);
        set({ subscriptionError: err instanceof Error ? err : new Error('Failed to process purchase') });
      }
    }
  };

  const handlePurchaseError = (error: PurchaseError) => {
    console.error('Purchase error:', error);
    set({ subscriptionError: new Error(error.message) });
  };

  const getAuthToken = async () => {
    const token = await getClerkInstance().session?.getToken();
    if (!token) throw new Error("No authentication token");
    return token;
  };

  return {
    subscriptionStatus: null,
    usageStats: null,
    subscriptionProducts: [],
    subscriptionLoading: false,
    subscriptionError: null,

    verifySubscription: async (receiptData: string) => {
      const token = await getAuthToken();

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
      set({ 
        subscriptionStatus: {
          isActive: data.subscription?.isValid || false,
          expiresDate: data.subscription?.expiresDate || null,
          type: data.subscription?.type || null,
          subscriptionId: data.subscription?.id || null
        } 
      });
      return data;
    },

    checkSubscriptionStatus: async () => {
      try {
        console.log("[Store] Checking subscription status...");
        const token = await getAuthToken();
        console.log("[Store] Auth token obtained, making API request");

        const response = await fetch(`${API_BASE_URL}/subscriptions/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("[Store] Subscription status API response status:", response.status);
        
        if (!response.ok) {
          console.error("[Store] Failed to check subscription status:", response.statusText);
          throw new Error("Failed to check subscription status");
        }

        const data = await response.json();
        console.log("[Store] Subscription status received:", JSON.stringify(data, null, 2));
        
        if (data.subscription) {
          set({ 
            subscriptionStatus: {
              isActive: data.subscription?.isValid || false,
              expiresDate: data.subscription?.expiresDate || null,
              type: data.subscription?.type || null,
              subscriptionId: data.subscription?.id || null
            } 
          });
          console.log("[Store] Subscription status updated in store:", JSON.stringify(data.subscription, null, 2));
        }
        return data;
      } catch (err) {
        console.error("[Store] Error in checkSubscriptionStatus:", JSON.stringify(err, null, 2));
        throw err;
      }
    },

    getUsageStats: async () => {
      try {
        console.log("[Store] Getting usage stats...");
        const token = await getAuthToken();
        console.log("[Store] Auth token obtained, making API request");

        const response = await fetch(`${API_BASE_URL}/usage/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("[Store] Usage stats API response status:", response.status);
        
        if (!response.ok) {
          console.error("[Store] Failed to fetch usage stats:", response.statusText);
          throw new Error("Failed to fetch usage stats");
        }

        const data = await response.json();
        console.log("[Store] Usage stats received:", JSON.stringify(data, null, 2));
        
        if (data.usage) {
          set({ usageStats: data.usage as UsageStats });
          console.log("[Store] Usage stats updated in store:", JSON.stringify(data.usage, null, 2));
        }
        return data;
      } catch (err) {
        console.error("[Store] Error in getUsageStats:", JSON.stringify(err, null, 2));
        throw err;
      }
    },

    initializeStore: async () => {
      try {
        set({ subscriptionLoading: true, subscriptionError: null });
        await initConnection();

        purchaseUpdateSubscription = purchaseUpdatedListener(handlePurchaseUpdate);
        purchaseErrorSubscription = purchaseErrorListener(handlePurchaseError);

        const products = await getSubscriptions({ skus: Object.values(SUBSCRIPTION_SKUS) });
        set({ 
          subscriptionProducts: products.map(product => ({
            productId: product.productId,
            title: product.title,
            description: product.description,
            price: Platform.OS === 'ios' 
              ? (product as SubscriptionIOS).localizedPrice || '0'
              : String((product as SubscriptionAndroid).price || 0),
            subscriptionOfferDetails: Platform.OS === 'android' 
              ? (product as SubscriptionAndroid).subscriptionOfferDetails 
              : undefined,
          }))
        });
      } catch (err) {
        set({ subscriptionError: err instanceof Error ? err : new Error('Failed to connect to store') });
      } finally {
        set({ subscriptionLoading: false });
      }
    },

    cleanupStore: () => {
      if (purchaseUpdateSubscription) {
        purchaseUpdateSubscription.remove();
      }
      if (purchaseErrorSubscription) {
        purchaseErrorSubscription.remove();
      }
      endConnection();
    },

    purchaseSubscription: async (productId: string, offerToken?: string) => {
      set({ subscriptionLoading: true, subscriptionError: null });
      try {
        if (Platform.OS === 'ios') {
          await requestSubscription({
            sku: productId,
            andDangerouslyFinishTransactionAutomaticallyIOS: false,
          });
        } else {
          await requestSubscription({
            sku: productId,
            ...(offerToken && { subscriptionOffers: [{ sku: productId, offerToken }] }),
          });
        }
      } catch (err) {
        set({ subscriptionError: err instanceof Error ? err : new Error('Failed to purchase subscription') });
        throw err;
      } finally {
        set({ subscriptionLoading: false });
      }
    },

    restorePurchases: async () => {
      set({ subscriptionLoading: true, subscriptionError: null });
      try {
        await get().checkSubscriptionStatus();
      } catch (err) {
        set({ subscriptionError: err instanceof Error ? err : new Error('Failed to restore purchases') });
        throw err;
      } finally {
        set({ subscriptionLoading: false });
      }
    },

    setInitialUsageStats: (stats: UsageStats) => {
      set({ usageStats: stats });
    },
  };
};