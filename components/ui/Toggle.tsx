import { colors, spacing, typography } from '@/constants/styles';
import React, { useCallback, useEffect, useRef } from 'react';
import {
    Animated,
    LayoutChangeEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface ToggleProps {
  options: [string, string];
  selectedIndex: 0 | 1;
  onChange: (index: 0 | 1) => void;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = React.memo(
  ({
    options,
    selectedIndex,
    onChange,
    disabled = false,
  }: ToggleProps) => {
    const [containerWidth, setContainerWidth] = React.useState(0);
    const sliderWidth = containerWidth / 2 - spacing.xs;
    const slideAnim = useRef(new Animated.Value(selectedIndex)).current;

    useEffect(() => {
      Animated.spring(slideAnim, {
        toValue: selectedIndex,
        useNativeDriver: true,
        bounciness: 8,
        speed: 14,
      }).start();
    }, [selectedIndex, slideAnim]);

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
      setContainerWidth(event.nativeEvent.layout.width);
    }, []);

    const handlePress = useCallback((index: 0 | 1) => {
      if (!disabled && index !== selectedIndex) {
          onChange(index);
      }
    }, [disabled, selectedIndex, onChange]);

    const translateX = slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [spacing.xs, sliderWidth + spacing.xs * 2],
    });

    return (
      <View
        style={[styles.container, disabled && styles.disabledContainer]}
        onLayout={handleLayout}
      >
        {containerWidth > 0 && (
          <Animated.View
            style={[
              styles.slider,
              { width: sliderWidth, transform: [{ translateX }] },
            ]}
          />
        )}
        {options.map((option, index) => (
          <TouchableOpacity
            key={option}
            style={styles.optionButton}
            onPress={() => handlePress(index as 0 | 1)}
            disabled={disabled}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={option}
            accessibilityState={{ selected: selectedIndex === index, disabled: disabled }}
          >
            <Text
              style={[
                styles.optionText,
                selectedIndex === index && styles.selectedOptionText,
                disabled && styles.disabledText
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.background.surface,
    borderRadius: 20,
    padding: spacing.xs,
    height: 40,
    alignItems: 'center',
    position: 'relative',
    minWidth: 160,
  },
  disabledContainer: {
     opacity: 0.6,
  },
  slider: {
    position: 'absolute',
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 16,
    top: spacing.xs,
    left: 0,
  },
  optionButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    zIndex: 1,
  },
  optionText: {
    ...typography.label1,
    color: colors.text.secondary,
  },
  selectedOptionText: {
    color: colors.text.inverse,
  },
  disabledText: {
    color: colors.inactive,
  },
});