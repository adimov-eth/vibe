import { Button } from '@/components/ui/Button';
import { colors, layout, spacing, typography } from '@/constants/styles';
import React, { useCallback } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

interface AccountSettingsCardProps {
  onSignOutPress: () => void;
}

export const AccountSettingsCard: React.FC<AccountSettingsCardProps> = React.memo(
  ({
    onSignOutPress,
  }: AccountSettingsCardProps) => {
    const handleSignOutConfirm = useCallback(() => {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: onSignOutPress },
        ],
      );
    }, [onSignOutPress]);

    return (
      <View style={styles.card}>
        <View style={styles.actionRow}>
          <Text style={styles.actionLabel}>Log out from your account</Text>
          <Button
            title="Sign Out"
            variant="outline"
            size="small"
            onPress={handleSignOutConfirm}
            leftIcon="log-out-outline"
          />
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.surface,
    borderRadius: layout.borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...layout.shadows.small,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  destructiveActionRow: {
    borderBottomWidth: 0,
  },
  actionLabel: {
    ...typography.body2,
    flex: 1,
    marginRight: spacing.md,
    color: colors.text.secondary,
  },
});