import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import useStore from '../state';
import type { StoreState } from '../state/types';
import { formatDate } from '../utils/date';

export const useUsage = () => {
  // Select state needed by the hook
  const {
    usageStats,
    subscriptionStatus,
    getUsageStats, // Keep for manual refresh
    checkSubscriptionStatus // Keep for manual refresh
  } = useStore(
    useShallow((state: StoreState) => ({
      usageStats: state.usageStats,
      subscriptionStatus: state.subscriptionStatus,
      getUsageStats: state.getUsageStats, // Still needed for refresh
      checkSubscriptionStatus: state.checkSubscriptionStatus // Still needed for refresh
    }))
  );

  // Local state for manual refresh feedback
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<Error | null>(null);
  const mountedRef = useRef(true); // Track if hook is still mounted

  // Mounted ref effect
  useEffect(() => {
      mountedRef.current = true;
      return () => { mountedRef.current = false; };
  }, []);

  // Manual refresh function
  const refreshUsageData = useCallback(async () => {
      // Prevent refresh if component is unmounted
      if (!mountedRef.current) {
          console.log("[useUsage:refreshUsageData] Aborted: Component unmounted.");
          return;
      }
      console.log("[useUsage:refreshUsageData] Manual refresh triggered...");
      setIsRefreshing(true);
      setRefreshError(null);
      try {
          // Call store actions directly for refresh
          console.log("[useUsage:refreshUsageData] Calling getUsageStats and checkSubscriptionStatus...");
          const results = await Promise.allSettled([getUsageStats(), checkSubscriptionStatus()]);
          console.log("[useUsage:refreshUsageData] Refresh calls finished.");

          // Check results for errors
          const usageResult = results[0];
          const statusResult = results[1];
          let firstError: Error | null = null;

          if (usageResult.status === 'rejected') {
              console.error("[useUsage:refreshUsageData] getUsageStats failed:", usageResult.reason);
              firstError = usageResult.reason instanceof Error ? usageResult.reason : new Error(String(usageResult.reason));
          }
          if (statusResult.status === 'rejected') {
              console.error("[useUsage:refreshUsageData] checkSubscriptionStatus failed:", statusResult.reason);
              if (!firstError) {
                  firstError = statusResult.reason instanceof Error ? statusResult.reason : new Error(String(statusResult.reason));
              }
          }

          // Update local error state only if still mounted and an error occurred
          if (mountedRef.current && firstError) {
              setRefreshError(firstError);
          }

      } catch (err) { // Catch unexpected errors during Promise.allSettled itself
          console.error("[useUsage:refreshUsageData] Unexpected error during manual refresh:", err);
          if (mountedRef.current) {
               setRefreshError(err instanceof Error ? err : new Error('Failed to refresh data'));
          }
      } finally {
          // Update loading state only if still mounted
          if (mountedRef.current) {
               setIsRefreshing(false);
               console.log("[useUsage:refreshUsageData] Manual refresh finished (finally block).");
          } else {
               console.log("[useUsage:refreshUsageData] Component unmounted before finally block finished.");
          }
      }
  }, [getUsageStats, checkSubscriptionStatus]); // Dependencies are the store actions

  // checkCanCreateConversation relies on the globally managed store state
  const checkCanCreateConversation = useCallback(() => {
    // Get the latest state directly from the hook's scope (updated via store subscription)
    const currentUsageStats = usageStats;
    const currentSubscriptionStatus = subscriptionStatus; // Also check subscription status directly

    console.log("[useUsage:checkCanCreateConversation] Checking ability to create. UsageStats:", currentUsageStats, "SubscriptionStatus:", currentSubscriptionStatus);

    // If either stats or status is null, it means the initial load might still be pending or failed.
    // Act cautiously - allow creation but log a warning.
    // The global loading state isn't directly used here, but the presence of data implies loading is done.
    if (!currentUsageStats || !currentSubscriptionStatus) {
      console.warn("[useUsage:checkCanCreateConversation] Usage/Subscription stats not fully available. Allowing creation, but backend checks will apply.");
      // Optionally, check a global loading state from the store if stricter control is needed
      // const isInitializing = useStore.getState().subscriptionLoading;
      // if (isInitializing) return false; // Example: prevent creation during initial load
      return true; // Allow provisional creation
    }

    // Use the states obtained from the store selector
    if (currentSubscriptionStatus.isActive || currentUsageStats.remainingConversations > 0) {
       console.log("[useUsage:checkCanCreateConversation] Allowed: Subscribed or has remaining conversations.");
       return true;
    }

    // If not subscribed and no remaining conversations, show alert and deny creation
    console.log("[useUsage:checkCanCreateConversation] Denied: Free trial ended or limit reached.");
    Alert.alert(
      'Free Trial Ended',
      `You've used all your free conversations for this week. They will reset on ${formatDate(
        currentUsageStats.resetDate
      )}.\n\nUpgrade to Premium for unlimited conversations.`,
      [
        { text: 'Maybe Later', style: 'cancel' },
        {
          text: 'Upgrade Now',
          onPress: () => {
            router.push('/paywall');
          },
        },
      ]
    );
    return false;
    // Dependencies now include subscriptionStatus as well
  }, [usageStats, subscriptionStatus, router]);

  return {
    // Return loading/error specific to manual refresh
    loading: isRefreshing,
    error: refreshError,
    // Expose the store state directly
    usageStats,
    subscriptionStatus,
    // Keep actions
    checkCanCreateConversation,
    refreshUsageData,
  };
};