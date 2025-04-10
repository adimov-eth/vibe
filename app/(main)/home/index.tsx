import { ModeCard } from '@/components/conversation/ModeCard';
import { AppBar } from '@/components/layout/AppBar';
import { Container } from '@/components/layout/Container';
import { colors, spacing, typography } from '@/constants/styles';
import { useUsage } from '@/hooks';
import useStore from '@/state';
import type { StoreState } from '@/state/types';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

interface Mode {
  id: string;
  title: string;
  description: string;
  color: string;
}

const CONVERSATION_MODES: Mode[] = [
  { id: 'mediator', title: 'Mediator', description: 'Get balanced insights', color: '#58BD7D' },
  { id: 'counselor', title: "Who's Right", description: 'Get a clear verdict', color: '#3B71FE' },
  { id: 'dinner', title: 'Dinner Planner', description: 'Decide what to eat', color: '#4BC9F0' },
  { id: 'movie', title: 'Movie Night', description: 'Find something to watch', color: '#FF6838' },
];

export default function Home() {
  const router = useRouter();

  const { usageStats, subscriptionStatus } = useStore(
    useShallow((state: StoreState) => ({
      usageStats: state.usageStats,
      subscriptionStatus: state.subscriptionStatus,
    }))
  );

  const usageHook = useUsage();
  const { loading, error, checkCanCreateConversation, refreshUsageData } = usageHook;

  const handleSelectMode = useCallback(async (mode: Mode) => {
    const canCreate = await checkCanCreateConversation();
    if (canCreate) {
      router.push(`../recording/${mode.id}`);
    }
  }, [checkCanCreateConversation, router]);

  if (loading && !usageStats) {
    return (
      <Container withSafeArea>
        <AppBar title="VibeCheck" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </Container>
    );
  }

  if (error && !usageStats) {
    return (
      <Container withSafeArea>
        <AppBar title="VibeCheck" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error.message || 'Failed to load subscription data'}</Text>
          <View style={styles.retryButtonContainer}>
            <Text style={styles.retryButton} onPress={refreshUsageData}>Retry</Text>
          </View>
        </View>
      </Container>
    );
  }

  const showInlineError = error && usageStats;

  return (
    <Container withSafeArea>
      <AppBar title="VibeCheck" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshUsageData}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {showInlineError && (
           <View style={styles.inlineErrorContainer}>
              <Text style={styles.inlineErrorText}>Could not refresh data: {error.message}</Text>
           </View>
        )}

        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Choose a Mode</Text>
            <Text style={styles.sectionSubtitle}>Select the type of conversation you want to have</Text>
          </View>

          <View style={styles.modesContainer}>
            {CONVERSATION_MODES.map((mode, index) => (
              <ModeCard
                key={mode.id}
                id={mode.id}
                mode={mode.id}
                title={mode.title}
                description={mode.description}
                color={mode.color}
                onPress={() => handleSelectMode(mode)}
                style={index === CONVERSATION_MODES.length - 1 ? styles.lastCard : undefined}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.section,
    paddingBottom: spacing.section,
  },
  sectionContainer: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.heading3,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  modesContainer: {
    width: '100%',
  },
  lastCard: {
    marginBottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body1,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorText: {
    ...typography.body1,
    color: colors.error,
    textAlign: 'center',
  },
  inlineErrorContainer: {
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
    marginHorizontal: spacing.lg,
  },
  inlineErrorText: {
      ...typography.body2,
      color: colors.error,
      textAlign: 'center',
  },
  retryButtonContainer: {
    marginTop: spacing.md,
  },
  retryButton: {
    ...typography.body1,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});