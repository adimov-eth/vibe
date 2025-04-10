import { ErrorMessage } from '@/components/feedback/ErrorMessage';
import { AppleAuthButton } from '@/components/forms/AppleAuthButton';
import { Container } from '@/components/layout/Container';
import { showToast } from '@/components/ui/Toast';
import { colors, spacing, typography } from '@/constants/styles';
import { storeAuthTokens } from '@/utils/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface AppleAuthResponse {
  data: {
    user: {
      id: string;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

export default function Authenticate() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAppleAuthSuccess = async (
    identityToken: string,
    userData: {
      userIdentifier: string;
      email?: string | null;
      fullName?: AppleAuthentication.AppleAuthenticationFullName | null;
    }
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/users/apple-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${identityToken}`,
        },
        body: JSON.stringify({
          identityToken,
          email: userData.email,
          fullName: userData.fullName,
        }),
      });

      interface BackendAuthResponse {
          success: boolean;
          data?: { user: { id: string } };
          error?: string;
          code?: string
      }

      const result = await response.json() as BackendAuthResponse;

      if (!response.ok || !result.success) {
          if (result.code === 'EMAIL_ALREADY_EXISTS') {
            const specificMessage = result.error || "This email is already linked to another account.";
            setError(specificMessage);
            showToast.error('Authentication Failed', specificMessage);
          } else {
            const errorMessage = result.error || 'Authentication failed on backend';
            throw new Error(errorMessage);
          }
          setIsLoading(false);
          return;
      }

      const userId = result.data?.user?.id;
      if (!userId) {
        throw new Error('Authentication succeeded but user ID was missing.');
      }

      await storeAuthTokens({
        identityToken,
        userId: userId,
        email: userData.email ?? undefined,
        fullName: userData.fullName ?? undefined,
      });

      showToast.success('Success', 'Authentication successful');
      router.replace('/(main)/home');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
      showToast.error('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleAuthError = (err: Error) => {
    if (err.message !== 'The operation was canceled.') {
      setError(err.message);
      showToast.error('Error', err.message);
    }
  };

  return (
    <Container contentContainerStyle={styles.container}>
      <View style={styles.logoContainer}>
        {}
        <Text style={styles.appName}>VibeCheck</Text>
      </View>
      {error && <ErrorMessage message={error} />}
      <View style={styles.authContainer}>
        <AppleAuthButton
          title="Welcome to VibeCheck"
          subtitle="Sign in with your Apple ID to get started"
          buttonText="CONTINUE"
          onSuccess={handleAppleAuthSuccess}
          onError={handleAppleAuthError}
        />
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  appName: {
    ...typography.heading1,
    fontSize: 32,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  authContainer: {
    width: '100%',
    marginVertical: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  footer: {
    marginTop: 'auto',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  footerText: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});