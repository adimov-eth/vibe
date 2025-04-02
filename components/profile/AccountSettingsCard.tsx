import { Button } from '@/components/ui/Button';
import { colors, layout, spacing } from '@/constants/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface AccountSettingsCardProps {
  onUpdatePasswordPress: () => void;
  onSignOutPress: () => void;
}

export const AccountSettingsCard: React.FC<AccountSettingsCardProps> = ({
  onUpdatePasswordPress,
  onSignOutPress,
}) => {
  return (
    <View style={styles.card}>
      <Button
        title="Update Password"
        onPress={onUpdatePasswordPress}
        variant="outline"
        leftIcon="lock-closed-outline"
        style={styles.button}
      />
      <Button
        title="Sign Out"
        onPress={onSignOutPress}
        variant="primary" // Consider 'destructive' variant if available/appropriate
        leftIcon="log-out-outline"
        style={styles.button}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.surface,
    borderRadius: layout.borderRadius.lg,
    padding: spacing.lg,
    ...layout.shadows.small,
  },
  button: {
    marginBottom: spacing.md,
  },
});