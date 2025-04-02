import { clearAuthTokens, getAuthTokens } from '@/utils/auth';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
}

export function useAuthentication() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated
  const checkAuthStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const tokens = await getAuthTokens();

      const hasAuth = !!tokens.identityToken && !!tokens.userId;
      setIsAuthenticated(hasAuth);

      if (hasAuth && tokens.userId) {
        setUser({
          id: tokens.userId,
          firstName: tokens.fullName?.givenName ?? null,
          lastName: tokens.fullName?.familyName ?? null,
          email: tokens.email,
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking authentication status:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await clearAuthTokens();
      setIsAuthenticated(false);
      setUser(null);

      // Navigate to the auth screen
      router.replace('/(auth)/authenticate');
    } catch (error) {
      console.error('Error signing out:', error);
      throw new Error('Failed to sign out');
    }
  }, [router]);

  // Initialize authentication check
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  return {
    isAuthenticated,
    isLoading,
    user,
    signOut,
    refreshAuthStatus: checkAuthStatus
  };
} 