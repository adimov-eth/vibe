import * as SecureStore from 'expo-secure-store';

// Define constants for SecureStore keys
const IDENTITY_TOKEN_KEY = 'auth_identity_token';
const SESSION_TOKEN_KEY = 'auth_session_token';
const USER_ID_KEY = 'auth_user_id';
const USER_EMAIL_KEY = 'auth_user_email';
const USER_FULLNAME_KEY = 'auth_user_fullname';

export interface AuthTokens {
  identityToken: string;
  sessionToken?: string;
  userId: string;
  email?: string;
  fullName?: {
    givenName?: string | null;
    familyName?: string | null;
  };
}

export async function storeAuthTokens(tokens: AuthTokens): Promise<void> {
  const tasks = [
    SecureStore.setItemAsync(IDENTITY_TOKEN_KEY, tokens.identityToken),
    SecureStore.setItemAsync(USER_ID_KEY, tokens.userId),
  ];

  if (tokens.sessionToken) {
    tasks.push(SecureStore.setItemAsync(SESSION_TOKEN_KEY, tokens.sessionToken));
  } else {
    // Ensure old session token is removed if not provided
    tasks.push(SecureStore.deleteItemAsync(SESSION_TOKEN_KEY));
  }

  if (tokens.email) {
    tasks.push(SecureStore.setItemAsync(USER_EMAIL_KEY, tokens.email));
  } else {
    tasks.push(SecureStore.deleteItemAsync(USER_EMAIL_KEY));
  }

  if (tokens.fullName) {
    tasks.push(SecureStore.setItemAsync(USER_FULLNAME_KEY, JSON.stringify(tokens.fullName)));
  } else {
    tasks.push(SecureStore.deleteItemAsync(USER_FULLNAME_KEY));
  }

  try {
    await Promise.all(tasks);
  } catch (error) {
    console.error('Failed to store auth tokens:', error);
    throw new Error('Failed to store authentication data');
  }
}

export async function getAuthTokens(): Promise<Partial<AuthTokens>> {
  try {
    const [identityToken, sessionToken, userId, email, fullNameStr] = await Promise.all([
      SecureStore.getItemAsync(IDENTITY_TOKEN_KEY),
      SecureStore.getItemAsync(SESSION_TOKEN_KEY),
      SecureStore.getItemAsync(USER_ID_KEY),
      SecureStore.getItemAsync(USER_EMAIL_KEY),
      SecureStore.getItemAsync(USER_FULLNAME_KEY),
    ]);

    let fullName: AuthTokens['fullName'] | undefined = undefined;
    if (fullNameStr) {
      try {
        fullName = JSON.parse(fullNameStr);
      } catch (e) {
        console.error('Failed to parse stored full name:', e);
        // Optionally clear the invalid data
        await SecureStore.deleteItemAsync(USER_FULLNAME_KEY);
      }
    }

    return {
      identityToken: identityToken || undefined,
      sessionToken: sessionToken || undefined,
      userId: userId || undefined,
      email: email || undefined,
      fullName,
    };
  } catch (error) {
    console.error('Failed to retrieve auth tokens:', error);
    throw new Error('Failed to retrieve authentication data');
  }
}

export async function clearAuthTokens(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(IDENTITY_TOKEN_KEY),
      SecureStore.deleteItemAsync(SESSION_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_ID_KEY),
      SecureStore.deleteItemAsync(USER_EMAIL_KEY),
      SecureStore.deleteItemAsync(USER_FULLNAME_KEY),
    ]);
  } catch (error) {
    console.error('Failed to clear auth tokens:', error);
    throw new Error('Failed to clear authentication data');
  }
}

export async function getAuthorizationHeader(): Promise<string | null> {
  try {
    const tokens = await getAuthTokens();
    // Prefer session token over identity token for API calls if available
    const token = tokens.sessionToken || tokens.identityToken;
    return token ? `Bearer ${token}` : null;
  } catch (error) {
    console.error('Failed to get authorization header:', error);
    return null;
  }
} 