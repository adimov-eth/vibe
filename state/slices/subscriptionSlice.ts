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
  console.error('[Store] EXPO_PUBLIC_API_URL environment variable is not set');
  throw new Error('API URL is not configured');
}

export const SUBSCRIPTION_SKUS = {
  MONTHLY: '2a',
  YEARLY: '2b',
} as const;

// Platform-specific subscription product interface
export interface PlatformSubscriptionProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  localizedPrice?: string; // iOS specific
  subscriptionOfferDetails?: Array<{
    offerToken: string;
    // Add other offer details as needed
  }>;
}

// Type guards for platform-specific products
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
        console.error('Error processing purchase:', err);
        set({
          subscriptionError:
            err instanceof Error ? err : new Error('Failed to process purchase'),
        });
      }
    }
  };

  const handlePurchaseError = (error: PurchaseError) => {
    console.error('Purchase error:', error);
    set({ subscriptionError: new Error(error.message) });
  };

  const getAuthToken = async () => {
    console.log('[Store] Getting authorization header');
    const authHeader = await getAuthorizationHeader();
    if (!authHeader) {
      console.error('[Store] No authentication token available');
      throw new Error('Authentication required. Please sign in to access subscription features.');
    }
    console.log('[Store] Authorization header retrieved successfully');
    return authHeader;
  };

  return {
    subscriptionStatus: null,
    usageStats: null,
    subscriptionProducts: [] as PlatformSubscriptionProduct[],
    subscriptionLoading: false,
    subscriptionError: null,

    verifySubscription: async (receiptData: string) => {
      const authHeader = await getAuthToken();
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

    checkSubscriptionStatus: async () => {
      try {
        const authHeader = await getAuthToken();
        const response = await fetch(`${API_URL}/subscriptions/status`, {
          headers: { Authorization: authHeader },
        });

        if (!response.ok) throw new Error('Failed to check subscription status');
        const data = await response.json();
        set({ subscriptionStatus: data.subscription });
        return data;
      } catch (err) {
        console.error('[Store] Error in checkSubscriptionStatus:', err);
        throw err;
      }
    },

    getUsageStats: async () => {
      try {
        const authHeader = await getAuthToken();
        const response = await fetch(`${API_URL}/usage/stats`, {
          headers: { Authorization: authHeader },
        });

        if (!response.ok) throw new Error('Failed to fetch usage stats');
        const data = await response.json();
        set({ usageStats: data.usage });
        return data;
      } catch (err) {
        console.error('[Store] Error in getUsageStats:', err);
        throw err;
      }
    },

    initializeStore: async () => {
      try {
        console.log('[Store] Starting subscription store initialization');
        set({ subscriptionLoading: true, subscriptionError: null });
        
        console.log('[Store] Initializing IAP connection');
        try {
          await initConnection();
          console.log('[Store] IAP connection initialized successfully');
        } catch (initError) {
          console.error('[Store] Failed to initialize IAP connection:', initError);
          throw initError;
        }
        
        console.log('[Store] Setting up purchase listeners');
        purchaseUpdateSubscription = purchaseUpdatedListener(handlePurchaseUpdate);
        purchaseErrorSubscription = purchaseErrorListener(handlePurchaseError);
        
        const skus = Object.values(SUBSCRIPTION_SKUS);
        console.log('[Store] Fetching subscription products with specific SKUs:', skus);
        console.log('[Store] Current platform:', Platform.OS);
        console.log('[Store] Bundle ID:', require('../../../app.json').expo.ios.bundleIdentifier);
        
        try {
          const rawProducts = await getSubscriptions({
            skus: skus,
          });
          
          if (rawProducts.length === 0) {
            console.log('[Store] No products found. This could be due to:');
            console.log('- Products not properly configured in App Store Connect');
            console.log('- Missing metadata for products');
            console.log('- Bundle ID mismatch');
            console.log('- Not using a sandbox test account');
          }
          
          console.log(`[Store] Found ${rawProducts.length} subscription products:`, 
            rawProducts.map(p => ({
              productId: p.productId,
              title: p.title,
              description: p.description,
              price: p.price
          })));

          // Map raw products to our consistent PlatformSubscriptionProduct interface
          const mappedProducts: PlatformSubscriptionProduct[] = rawProducts.map((product): PlatformSubscriptionProduct => {
            let price = 'N/A';
            let offerDetails: PlatformSubscriptionProduct['subscriptionOfferDetails'] | undefined = undefined;

            if (isIOSSubscription(product)) {
              console.log('[Store] Processing iOS product:', {
                productId: product.productId,
                title: product.title,
                price: product.price,
                description: product.description
              });
              price = String(product.price ?? 'N/A');
            } else if (isAndroidSubscription(product)) {
              console.log('[Store] Processing Android product:', {
                productId: product.productId,
                title: product.title,
                price: product.price,
                description: product.description
              });
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

          console.log('[Store] Mapped products:', mappedProducts);
          set({ subscriptionProducts: mappedProducts });
        } catch (err) {
          console.error('[Store] Error fetching products:', err instanceof Error ? err.message : err);
          throw new Error('Failed to fetch subscription products');
        }

        console.log('[Store] Checking subscription status and usage stats');
        await Promise.all([
          get().checkSubscriptionStatus(),
          get().getUsageStats(),
        ]);
        
        console.log('[Store] Store initialization completed successfully');
      } catch (err) {
        console.error('[Store] Failed to initialize subscription store:', err);
        set({
          subscriptionError:
            err instanceof Error ? err : new Error('Failed to connect to store'),
        });
      } finally {
        set({ subscriptionLoading: false });
      }
    },

    cleanupStore: () => {
      if (purchaseUpdateSubscription) purchaseUpdateSubscription.remove();
      if (purchaseErrorSubscription) purchaseErrorSubscription.remove();
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