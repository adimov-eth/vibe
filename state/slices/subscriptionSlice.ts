import { getAuthorizationHeader } from '@/utils/auth';
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
  Subscription,
  SubscriptionAndroid,
  SubscriptionIOS,
} from 'react-native-iap';
import { StateCreator } from 'zustand';
import { StoreState, SubscriptionSlice, UsageStats } from '../types';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error('API URL is not configured');
}

export const SUBSCRIPTION_SKUS = {
  MONTHLY: '2a',
  YEARLY: '2b',
} as const;

export interface PlatformSubscriptionProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  localizedPrice?: string
  subscriptionOfferDetails?: Array<{
    offerToken: string
  }>;
}

function isIOSSubscription(product: Subscription): product is SubscriptionIOS {
  return Platform.OS === 'ios';
}

function isAndroidSubscription(product: Subscription): product is SubscriptionAndroid {
  return Platform.OS === 'android';
}

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
        const result = await get().verifySubscription(receipt);
        set({ subscriptionStatus: result.subscription });
      } catch (err) {
        set({
          subscriptionError:
            err instanceof Error ? err : new Error('Failed to process purchase'),
        });
      }
    }
  };

  const handlePurchaseError = (error: PurchaseError) => {
    set({ subscriptionError: new Error(error.message) });
  };

  const getAuthTokenInternal = async () => {
    const authHeader = await getAuthorizationHeader();
    if (!authHeader) {} else {}
    return authHeader;
  };

  return {
    subscriptionStatus: null,
    usageStats: null,
    subscriptionProducts: [] as PlatformSubscriptionProduct[],
    subscriptionLoading: false,
    subscriptionError: null,
    isInitialized: false,

    verifySubscription: async (receiptData: string) => {
      const authHeader = await getAuthTokenInternal();
      if (!authHeader) {
        throw new Error('Authentication required to verify subscription.');
      }
      
      const response = await fetch(`${API_URL}/subscriptions/verify`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ receiptData }),
      });

      if (!response.ok) throw new Error('Failed to verify subscription');
      const data = await response.json();
      set({ subscriptionStatus: data.subscription });
      return data;
    },

    checkSubscriptionStatus: async (authToken?: string) => {
      const tokenToUse = authToken ?? (await getAuthTokenInternal());
      if (!tokenToUse) {
        set({ subscriptionStatus: { isActive: false, expiresDate: null, type: null, subscriptionId: null } });
        throw new Error('Authentication required.');
      }
      try {
        const response = await fetch(`${API_URL}/subscriptions/status`, {
          headers: { Authorization: tokenToUse },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Failed to check subscription status (Status: ${response.status})`);
        }
        const data = await response.json();
        if (data && typeof data.subscription !== 'undefined') {
             set({ subscriptionStatus: data.subscription });
        } else {
          set({ subscriptionStatus: { isActive: false, expiresDate: null, type: null, subscriptionId: null } });
        }
        return data;
      } catch (err) {
        set({ subscriptionStatus: { isActive: false, expiresDate: null, type: null, subscriptionId: null } });
        throw err;
      }
    },

    getUsageStats: async (authToken?: string) => {
      const tokenToUse = authToken ?? (await getAuthTokenInternal());
      if (!tokenToUse) {
        set({ usageStats: { currentUsage: 0, limit: 0, isSubscribed: false, remainingConversations: 0, resetDate: 0 } });
        throw new Error('Authentication required.');
      }
      try {
        const response = await fetch(`${API_URL}/users/usage`, {
          headers: { Authorization: tokenToUse },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Failed to fetch usage stats (Status: ${response.status})`);
        }
        const data = await response.json();
        if (!data.usage) {
          set({ usageStats: { currentUsage: 0, limit: 0, isSubscribed: false, remainingConversations: 0, resetDate: 0 } });
          throw new Error('Invalid usage data received from server');
        }
        set({ usageStats: data.usage });
        return data;
      } catch (err) {
        set({ usageStats: { currentUsage: 0, limit: 0, isSubscribed: false, remainingConversations: 0, resetDate: 0 } });
        throw err;
      }
    },

    initializeAppState: async () => {
      if (get().isInitialized || get().subscriptionLoading) {
        return;
      }
      set({ subscriptionLoading: true, subscriptionError: null });

      try {
        const authToken = await getAuthTokenInternal();
        if (authToken) {
          try {
            await initConnection();
          } catch (initError) {
            set({ subscriptionError: new Error('Failed to connect to App Store') });
          }

          if (purchaseUpdateSubscription) purchaseUpdateSubscription.remove();
          if (purchaseErrorSubscription) purchaseErrorSubscription.remove();
          purchaseUpdateSubscription = purchaseUpdatedListener(handlePurchaseUpdate);
          purchaseErrorSubscription = purchaseErrorListener(handlePurchaseError);

          const skus = Object.values(SUBSCRIPTION_SKUS);

          await Promise.allSettled([
            (async () => {
                try {
                  const rawProducts = await getSubscriptions({ skus: skus });
                  const mappedProducts: PlatformSubscriptionProduct[] = rawProducts.map((product): PlatformSubscriptionProduct => {
                    let price = 'N/A';
                    let offerDetails: PlatformSubscriptionProduct['subscriptionOfferDetails'] | undefined = undefined;

                    if (isIOSSubscription(product)) {
                      price = String(product.price ?? 'N/A');
                    } else if (isAndroidSubscription(product)) {
                      price = String(product.price ?? 'N/A');
                      offerDetails = product.subscriptionOfferDetails?.map(offer => ({
                        offerToken: offer.offerToken,
                      }));
                    }

                    return {
                      productId: product.productId,
                      title: product.title,
                      description: product.description,
                      price,
                      ...(isIOSSubscription(product) && { localizedPrice: String(product.price) }),
                      ...(isAndroidSubscription(product) && { subscriptionOfferDetails: offerDetails }),
                    };
                  });
                  set({ subscriptionProducts: mappedProducts });
                } catch (err) {
                  set({ subscriptionError: new Error('Failed to fetch subscription products') });
                }
            })(),
            get().checkSubscriptionStatus(authToken),
            get().getUsageStats(authToken)
          ]);
        } else {
          try {
              await initConnection();
              if (purchaseUpdateSubscription)
                purchaseUpdateSubscription.remove();
              if (purchaseErrorSubscription) purchaseErrorSubscription.remove();
              purchaseUpdateSubscription = purchaseUpdatedListener(handlePurchaseUpdate);
              purchaseErrorSubscription = purchaseErrorListener(handlePurchaseError);
          } catch (initError) {
            set({ subscriptionError: new Error('Failed to connect to App Store') });
          }
          set({
               subscriptionStatus: { isActive: false, expiresDate: null, type: null, subscriptionId: null },
               usageStats: { currentUsage: 0, limit: 0, isSubscribed: false, remainingConversations: 0, resetDate: 0 }
          });
        }

        set({ isInitialized: true });
      } catch (err) {
        set({
          subscriptionError:
            err instanceof Error ? err : new Error('Failed during app initialization'),
           isInitialized: true,
        });
      } finally {
        set({ subscriptionLoading: false });
      }
    },

    cleanupStore: () => {
      if (purchaseUpdateSubscription) purchaseUpdateSubscription.remove();
      if (purchaseErrorSubscription) purchaseErrorSubscription.remove();
      try {
        endConnection();
      } catch (endError) {}
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
        const error =
          err instanceof Error ? err : new Error('Failed to purchase subscription');
        set({ subscriptionError: error });
        throw error;
      } finally {
        set({ subscriptionLoading: false });
      }
    },

    restorePurchases: async () => {
      set({ subscriptionLoading: true, subscriptionError: null });
      try {
         await get().checkSubscriptionStatus();
      } catch (err) {
        set({
          subscriptionError:
            err instanceof Error ? err : new Error('Failed to restore purchases'),
        });
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