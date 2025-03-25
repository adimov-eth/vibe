import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import useStore from "../state";
import { formatDate } from "../utils/date";

export const useUsage = () => {
  const { getUsageStats, usageStats, subscriptionStatus } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await getUsageStats();
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [getUsageStats]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const checkCanCreateConversation = useCallback(() => {
    if (!usageStats) {
      if (!hasShownWelcome) {
        Alert.alert(
          'Welcome!',
          'Start your free trial with 10 conversations per week.'
        );
        setHasShownWelcome(true);
      }
      return true;
    }

    if (usageStats.isSubscribed) {
      return true;
    }

    if (usageStats.remainingConversations > 0) {
      if (!hasShownWelcome) {
        Alert.alert(
          'Free Trial',
          `You have ${usageStats.remainingConversations} conversations remaining this week. Reset on ${formatDate(usageStats.resetDate)}.`
        );
        setHasShownWelcome(true);
      }
      return true;
    }

    Alert.alert(
      'Free Trial Ended',
      `You've used all your free conversations for this week. They will reset on ${formatDate(usageStats.resetDate)}.\n\nUpgrade to Premium for unlimited conversations.`,
      [
        { text: 'Maybe Later', style: 'cancel' },
        { text: 'Upgrade Now', onPress: () => {
          // TODO: Navigate to subscription screen
        }}
      ]
    );
    return false;
  }, [usageStats, hasShownWelcome]);

  return {
    loading,
    error,
    usageStats,
    subscriptionStatus,
    checkCanCreateConversation,
    loadData
  };
}; 