import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useStore from '../state/index';
import type { StoreState } from '../state/types';

export const useSubscription = () => {
  const {
    subscriptionProducts,
    subscriptionLoading,
    subscriptionError,
    subscriptionStatus,
    purchaseSubscription,
    restorePurchases,
    cleanupStore
  } = useStore(
    useShallow((state: StoreState) => ({
      subscriptionProducts: state.subscriptionProducts,
      subscriptionLoading: state.subscriptionLoading,
      subscriptionError: state.subscriptionError,
      subscriptionStatus: state.subscriptionStatus,
      purchaseSubscription: state.purchaseSubscription,
      restorePurchases: state.restorePurchases,
      cleanupStore: state.cleanupStore
    }))
  );

  useEffect(() => {
    return () => {
      cleanupStore();
    };
  }, [cleanupStore]);

  return {
    isSubscribed: subscriptionStatus?.isActive ?? false,
    subscriptionProducts,
    purchase: purchaseSubscription,
    restore: restorePurchases,
    isLoading: subscriptionLoading,
    error: subscriptionError,
  };
}; 