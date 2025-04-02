import { AppBar } from '@/components/layout/AppBar';
import { AppDataCard } from '@/components/profile/AppDataCard';
import { SubscriptionCard } from '@/components/profile/SubscriptionCard';
import { Button } from '@/components/ui/Button';
import { colors, layout, spacing, typography } from '@/constants/styles';
import { useAuthentication } from '@/hooks/useAuthentication';
import { useClearCache } from '@/hooks/useClearCache';
import { useUsage } from '@/hooks/useUsage';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useAuthentication();
  const { clearCache, isClearing, error: clearError } = useClearCache();
  const { subscriptionStatus, usageStats, loading, error, loadData } = useUsage();

  useEffect(() => {
    const fetchData = async () => {
      if (!subscriptionStatus || !usageStats) {
        await loadData(); // Load initial data if not present
      }
    };
    fetchData();
  }, []); // Removed dependency array to rely on explicit load/refresh

  const handleBackPress = () => router.back();
  const handleSignOut = async () => await signOut();
  const navigateToPaywall = () => router.push('/(main)/paywall');

  // Calculate derived values (memoize if necessary, but likely fine here)
  const currentUsage = usageStats?.currentUsage ?? 0;
  const remainingConversations = usageStats?.remainingConversations ?? 0;
  const usageLimit = usageStats ? currentUsage + remainingConversations : 0;

  const ProfileHeader = React.memo(() => ( // Memoize static header
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

  // Loading state
  if (loading && !usageStats && !subscriptionStatus) { // More precise initial loading check
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

  // Error state
  if (error && !usageStats && !subscriptionStatus) { // More precise initial error check
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppBar title="Profile" showBackButton={true} onBackPress={handleBackPress} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error.message || 'Failed to load profile data'}</Text>
          <Button title="Retry" variant="primary" onPress={loadData} style={styles.retryButton}/>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppBar
        title="Profile"
        showBackButton={true}
        showAvatar={false} // Avatar is shown in the header below
        onBackPress={handleBackPress}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
           <RefreshControl
             refreshing={loading} // Use the 'loading' state for the refreshing indicator
             onRefresh={loadData} // Call 'loadData' when pulled
             tintColor={colors.primary}
           />
        }
       >
        <ProfileHeader />

        {/* Display error inline if it occurs during refresh */}
        {error && (
           <View style={styles.inlineErrorContainer}>
              <Text style={styles.inlineErrorText}>Error refreshing data: {error.message}</Text>
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
            showDevOptions={__DEV__} // Show dev options only in development
            currentUsage={currentUsage}
            usageLimit={usageLimit}
            onViewPaywallPress={navigateToPaywall}
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper component for consistent section styling
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.primary },
  container: { flex: 1, backgroundColor: colors.background.primary },
  contentContainer: { padding: spacing.lg, paddingBottom: spacing.xl }, // Add bottom padding
  profileHeader: { alignItems: 'center', marginVertical: spacing.xl },
  avatarContainer: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md,
    ...layout.shadows.small,
  },
  avatarText: { fontSize: 32, color: colors.text.inverse, fontFamily: 'Inter-Bold' }, // Ensure font is loaded
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
  },
  inlineErrorText: {
      ...typography.body2,
      color: colors.error,
      textAlign: 'center',
  },
});
