import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import useStore from '../state';
import type { StoreState } from '../state/types';
import { formatDate } from '../utils/date';

interface UseUsageResult {
  loading: boolean;
  error: Error | null;
  usageStats: StoreState['usageStats'];
  subscriptionStatus: StoreState['subscriptionStatus'];
  checkCanCreateConversation: () => boolean;
  refreshUsageData: () => Promise<void>;
}

/**
 * Hook to manage app usage stats and subscription status
 * Provides functionality to check if user can create new conversations
 */
export const useUsage = (): UseUsageResult => {
  // Select only the state needed by this hook
  const {
    usageStats,
    subscriptionStatus,
    getUsageStats,
    checkSubscriptionStatus
  } = useStore(
    useShallow((state: StoreState) => ({
      usageStats: state.usageStats,
      subscriptionStatus: state.subscriptionStatus,
      getUsageStats: state.getUsageStats,
      checkSubscriptionStatus: state.checkSubscriptionStatus
    }))
  );

  // Local state for manual refresh tracking
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<Error | null>(null);
  
  // Track component mount status
  const mountedRef = useRef(true);

  // Set up mount tracking
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /**
   * Refresh usage and subscription data from the server
   */
  const refreshUsageData = useCallback(async () => {
    // Skip if component unmounted
    if (!mountedRef.current) return;
    
    setIsRefreshing(true);
    setRefreshError(null);
    
    try {
      // Call both API methods in parallel
      const results = await Promise.allSettled([
        getUsageStats(), 
        checkSubscriptionStatus()
      ]);
      
      // Handle potential errors
      const usageResult = results[0];
      const statusResult = results[1];
      let firstError: Error | null = null;

      if (usageResult.status === 'rejected') {
        firstError = usageResult.reason instanceof Error 
          ? usageResult.reason 
          : new Error(String(usageResult.reason));
      }
      
      if (statusResult.status === 'rejected' && !firstError) {
        firstError = statusResult.reason instanceof Error 
          ? statusResult.reason 
          : new Error(String(statusResult.reason));
      }

      // Update error state if component is still mounted
      if (mountedRef.current && firstError) {
        setRefreshError(firstError);
      }
    } catch (err) {
      // Handle unexpected errors
      if (mountedRef.current) {
        setRefreshError(err instanceof Error ? err : new Error('Failed to refresh data'));
      }
    } finally {
      // Reset loading state if still mounted
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [getUsageStats, checkSubscriptionStatus]);

  /**
   * Check if the user can create a new conversation
   * Shows an alert if they've reached their limit
   */
  const checkCanCreateConversation = useCallback(() => {
    // Get latest state from the store
    const currentUsageStats = usageStats;
    const currentSubscriptionStatus = subscriptionStatus;

    // If stats aren't loaded yet, allow creation but log a warning
    if (!currentUsageStats || !currentSubscriptionStatus) {
      return true;
    }

    // Allow if subscribed or has remaining conversations
    if (currentSubscriptionStatus.isActive || 
        currentUsageStats.remainingConversations > 0) {
      return true;
    }

    // If not subscribed and no remaining conversations, show alert
    Alert.alert(
      'Free Trial Ended',
      `You've used all your free conversations for this week. They will reset on ${formatDate(
        currentUsageStats.resetDate
      )}.\n\nUpgrade to Premium for unlimited conversations.`,
      [
        { text: 'Maybe Later', style: 'cancel' },
        {
          text: 'Upgrade Now',
          onPress: () => router.push('/paywall'),
        },
      ]
    );
    
    return false;
  }, [usageStats, subscriptionStatus, router]);

  return {
    loading: isRefreshing,
    error: refreshError,
    usageStats,
    subscriptionStatus,
    checkCanCreateConversation,
    refreshUsageData,
  };
};