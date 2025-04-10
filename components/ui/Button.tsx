import { colors, layout, spacing, typography } from '@/constants/styles';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    ActivityIndicator,
    StyleProp,
    StyleSheet,
    Text,
    TouchableOpacity,
    ViewStyle,
} from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive';
  size?: 'small' | 'medium' | 'large';
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Button: React.FC<ButtonProps> = React.memo(
  ({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    leftIcon,
    rightIcon,
    loading = false,
    disabled = false,
    style,
    testID,
  }: ButtonProps) => {
    const isDisabled = disabled || loading;

    const buttonStyles = [
      styles.button,
      styles[`${variant}Button`],
      styles[`${size}Button`],
      isDisabled && styles.disabledButton,
      style,
    ];

    const textStyles = [
      styles.text,
      styles[`${variant}Text`],
      styles[`${size}Text`],
      isDisabled && styles.disabledText,
    ];

    const iconColor = isDisabled
      ? styles[`${variant}DisabledText`]?.color || colors.inactive
      : styles[`${variant}Text`]?.color || colors.text.primary;

    const iconSize = size === 'small' ? 16 : size === 'large' ? 24 : 20;

    return (
      <TouchableOpacity
        style={buttonStyles}
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.7}
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        accessibilityLabel={title}
      >
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <>
            {leftIcon && (
              <Ionicons
                name={leftIcon}
                size={iconSize}
                color={iconColor}
                style={styles.iconLeft}
              />
            )}
            <Text style={textStyles}>{title}</Text>
            {rightIcon && (
              <Ionicons
                name={rightIcon}
                size={iconSize}
                color={iconColor}
                style={styles.iconRight}
              />
            )}
          </>
        )}
      </TouchableOpacity>
    );
  }
);

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: layout.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  text: {
    ...typography.label1,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  primaryText: {
    color: colors.text.inverse,
  },
  secondaryButton: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.background.secondary,
  },
  secondaryText: {
    color: colors.text.primary,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  outlineText: {
    color: colors.text.primary,
  },
  destructiveButton: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  destructiveText: {
    color: colors.text.inverse,
  },
  smallButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  smallText: {
    ...typography.label2,
  },
  mediumButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  mediumText: {
    ...typography.label1,
  },
  largeButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  largeText: {
    ...typography.button1,
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledText: {},
  primaryDisabledText: { color: colors.text.inverse },
  secondaryDisabledText: { color: colors.text.primary },
  outlineDisabledText: { color: colors.text.primary },
  destructiveDisabledText: { color: colors.text.inverse },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
});