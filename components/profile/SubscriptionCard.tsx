import { Button } from '@/components/ui/Button';
import { colors, layout, spacing, typography } from '@/constants/styles';
import type { SubscriptionStatus, UsageStats } from '@/state/types';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface SubscriptionCardProps {
  subscriptionStatus: SubscriptionStatus | null;
  usageStats: UsageStats | null;
  onUpgradePress: () => void;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = React.memo(
  ({
    subscriptionStatus,
    usageStats,
    onUpgradePress,
  }: SubscriptionCardProps) => {
    const isActive = subscriptionStatus?.isActive ?? false;
    const expiresDateMs = subscriptionStatus?.expiresDate;
    const remainingConversations = usageStats?.remainingConversations ?? 0;
    const resetDate = usageStats?.resetDate;

    const getFormattedDate = (timestamp: number | null | undefined) => {
      if (!timestamp) return 'Unknown';
      const date = new Date(timestamp);
      if (date < new Date() && isActive)
        return 'Expired';
      return date.toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    };

    const getUsageText = () => {
      if (!usageStats) return 'Loading usage...';
      if (isActive)
        return `Plan: ${subscriptionStatus?.type === 'monthly' ? 'Monthly' : 'Yearly'}`;

      if (remainingConversations > 0) {
         return `${remainingConversations} conversation${remainingConversations === 1 ? '' : 's'} left`;
      } else {
         return 'No free conversations left';
      }
    };

    const getExpiryOrResetText = () => {
         if (isActive) {
             return `Renews on ${getFormattedDate(expiresDateMs)}`;
         } else if (remainingConversations <= 0) {
              return `Resets on ${getFormattedDate(resetDate)}`;
         }
         return null;
    };

    return (
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Status</Text>
          <Text style={[styles.value, isActive ? styles.statusPremium : styles.statusFree]}>
            {isActive ? 'Premium' : 'Free'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>{isActive ? 'Plan / Usage' : 'Usage'}</Text>
          <Text style={styles.value}>{getUsageText()}</Text>
           {getExpiryOrResetText() && (
               <Text style={styles.detailText}>{getExpiryOrResetText()}</Text>
           )}
        </View>

        {!isActive && (
          <Button
            title="Upgrade to Premium"
            onPress={onUpgradePress}
            variant="outline"
            leftIcon="star-outline"
            style={styles.upgradeButton}
          />
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.surface,
    borderRadius: layout.borderRadius.lg,
    padding: spacing.lg,
    ...layout.shadows.small,
  },
  infoRow: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.body1,
    fontWeight: '500',
  },
  detailText: {
       ...typography.caption,
       color: colors.text.secondary,
       marginTop: spacing.xs,
  },
  statusPremium: {
    color: colors.status.success,
    fontWeight: '600',
  },
  statusFree: {
    color: colors.primary,
    fontWeight: '600',
  },
  upgradeButton: {
    marginTop: spacing.sm,
  },
});