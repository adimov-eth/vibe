import { AppBar } from '@/components/layout/AppBar';
import { AccountSettingsCard } from '@/components/profile/AccountSettingsCard';
import { AppDataCard } from '@/components/profile/AppDataCard';
import { SubscriptionCard } from '@/components/profile/SubscriptionCard';
import { Button } from '@/components/ui/Button';
import { colors, layout, spacing, typography } from '@/constants/styles';
import { useAuthentication } from '@/hooks/useAuthentication';
import { useClearCache } from '@/hooks/useClearCache';
import { useUsage } from '@/hooks/useUsage';
import useStore from '@/state';
import type { StoreState } from '@/state/types';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

export default function Profile() {
  const router = useRouter();

  const { user, signOut } = useAuthentication();
  const { clearCache, isClearing, error: clearError } = useClearCache();
  const { subscriptionStatus, usageStats } = useStore(
      useShallow((state: StoreState) => ({
        subscriptionStatus: state.subscriptionStatus,
        usageStats: state.usageStats,
      }))
  );
  const { loading, error, refreshUsageData } = useUsage();

  const handleBackPress = useCallback(() => router.back(), [router]);
  const handleSignOut = useCallback(async () => await signOut(), [signOut]);
  const navigateToPaywall = useCallback(() => router.push('/(main)/paywall'), [router]);

  const currentUsage = usageStats?.currentUsage ?? 0;
  const remainingConversations = usageStats?.remainingConversations ?? 0;
  const usageLimit = usageStats?.limit ?? 0;

  const ProfileHeader = React.memo(() => (
    <View style={styles.profileHeader}>
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>
          {user?.firstName?.[0] || user?.email?.[0] || '?'}
        </Text>
      </View>
      <Text style={styles.userName}>
        {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User'}
      </Text>
      <Text style={styles.userEmail}>
        {user?.email || 'No email provided'}
      </Text>
    </View>
  ));

  if (loading && !usageStats && !subscriptionStatus) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppBar title="Profile" showBackButton={true} onBackPress={handleBackPress} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !usageStats && !subscriptionStatus) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppBar title="Profile" showBackButton={true} onBackPress={handleBackPress} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error.message || 'Failed to load profile data'}</Text>
          <Button title="Retry" variant="primary" onPress={refreshUsageData} style={styles.retryButton}/>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppBar
        title="Profile"
        showBackButton={true}
        showAvatar={false}
        onBackPress={handleBackPress}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
           <RefreshControl
             refreshing={loading}
             onRefresh={refreshUsageData}
             tintColor={colors.primary}
             colors={[colors.primary]}
           />
        }
       >
        <ProfileHeader />

        {error && (usageStats || subscriptionStatus) && (
           <View style={styles.inlineErrorContainer}>
              <Text style={styles.inlineErrorText}>Could not refresh data: {error.message}</Text>
           </View>
        )}

        <Section title="Subscription">
          <SubscriptionCard
            subscriptionStatus={subscriptionStatus}
            usageStats={usageStats}
            onUpgradePress={navigateToPaywall}
          />
        </Section>

        <Section title="App Data">
          <AppDataCard
            isClearingCache={isClearing}
            onClearCachePress={clearCache}
            clearCacheError={clearError}
            showDevOptions={__DEV__}
            currentUsage={currentUsage}
            usageLimit={usageLimit}
            remainingConversations={remainingConversations}
            resetDate={usageStats?.resetDate}
            isSubscribed={usageStats?.isSubscribed ?? false}
            onViewPaywallPress={navigateToPaywall}
          />
        </Section>

        <Section title="Account Settings">
          <AccountSettingsCard
            onSignOutPress={handleSignOut}
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = React.memo(({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
));

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.primary },
  container: { flex: 1, backgroundColor: colors.background.primary },
  contentContainer: { padding: spacing.lg, paddingBottom: spacing.xl },
  profileHeader: { alignItems: 'center', marginVertical: spacing.xl },
  avatarContainer: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md,
    ...layout.shadows.small,
  },
  avatarText: { fontSize: 32, color: colors.text.inverse, fontFamily: 'Inter-Bold' },
  userName: { ...typography.heading2, marginBottom: spacing.xs, color: colors.text.primary },
  userEmail: { ...typography.body1, color: colors.text.secondary },
  section: { marginBottom: spacing.xl },
  sectionTitle: { ...typography.heading3, marginBottom: spacing.md, color: colors.text.primary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...typography.body1, color: colors.text.secondary, marginTop: spacing.md },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  errorText: { ...typography.body1, color: colors.error, textAlign: 'center', marginBottom: spacing.md },
  retryButton: { minWidth: 120 },
  inlineErrorContainer: {
      backgroundColor: colors.errorLight,
      padding: spacing.md,
      borderRadius: layout.borderRadius.md,
      marginBottom: spacing.lg,
      marginHorizontal: spacing.lg,
  },
  inlineErrorText: {
      ...typography.body2,
      color: colors.error,
      textAlign: 'center',
  },
});