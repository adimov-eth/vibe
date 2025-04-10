import { clearAuthTokens, getAuthTokens } from '@/utils/auth';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  const initialCheckAttemptedRef = useRef(false);

  const checkAuthStatus = useCallback(async () => {
    console.log('[useAuthentication] checkAuthStatus CALLED');
    let finalIsAuthenticated: boolean = false;
    let finalUser: AuthUser | null = null;

    try {
      const tokens = await getAuthTokens();
      const hasAuth = !!tokens.identityToken && !!tokens.userId;
      finalIsAuthenticated = hasAuth;

      if (hasAuth && tokens.userId) {
        finalUser = {
          id: tokens.userId,
          firstName: tokens.fullName?.givenName ?? null,
          lastName: tokens.fullName?.familyName ?? null,
          email: tokens.email,
        };
      } else {
        finalUser = null;
      }
    } catch (error) {
      finalIsAuthenticated = false;
      finalUser = null;
    } finally {
      const currentIsLoading = isLoading;
      const currentIsAuthenticated = isAuthenticated;
      const currentUserId = user?.id;

      setUser(currentUser => {
        if (JSON.stringify(currentUser) !== JSON.stringify(finalUser)) {
          return finalUser;
        }
        return currentUser;
      });
      setIsAuthenticated(currentAuth => {
        if (currentAuth !== finalIsAuthenticated) {
          return finalIsAuthenticated;
        }
        return currentAuth;
      });
      setIsLoading(currentLoading => {
        if (currentLoading) {
          return false;
        }
        return currentLoading;
      });
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await clearAuthTokens();
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);

      router.replace('/(auth)/authenticate');
    } catch (error) {
      throw new Error('Failed to sign out');
    }
  }, [router]);

  useEffect(() => {
    if (!initialCheckAttemptedRef.current) {
      initialCheckAttemptedRef.current = true;
      checkAuthStatus();
    } else {}
  }, [checkAuthStatus]);

  return {
    isAuthenticated,
    isLoading,
    user,
    signOut,
    refreshAuthStatus: checkAuthStatus
  };
}