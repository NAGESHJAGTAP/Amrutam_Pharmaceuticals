import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthSuccessData, MfaChallengeData } from '@/types/auth.types';
import { authApi, LoginPayload, RegisterPatientPayload, VerifyMfaPayload } from '@/lib/api/auth.api';
import { getStoredAccessToken, getStoredRefreshToken, setStoredTokens, clearStoredTokens } from '@/lib/api/client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<AuthSuccessData | MfaChallengeData>;
  register: (payload: RegisterPatientPayload) => Promise<AuthSuccessData>;
  verifyMfa: (payload: VerifyMfaPayload) => Promise<AuthSuccessData>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = useCallback(async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await authApi.getMe();
      if (response.success && response.data?.user) {
        setUser(response.data.user);
      } else {
        clearStoredTokens();
        setUser(null);
      }
    } catch {
      // Failed to load user profile with current token
      clearStoredTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();

    const handleSessionExpired = () => {
      setUser(null);
      clearStoredTokens();
    };

    window.addEventListener('carebridge_session_expired', handleSessionExpired);
    window.addEventListener('amrutam_session_expired', handleSessionExpired);
    return () => {
      window.removeEventListener('carebridge_session_expired', handleSessionExpired);
      window.removeEventListener('amrutam_session_expired', handleSessionExpired);
    };
  }, [fetchCurrentUser]);

  const login = async (payload: LoginPayload): Promise<AuthSuccessData | MfaChallengeData> => {
    const response = await authApi.login(payload);
    const data = response.data;

    // Check if MFA challenge was returned
    if ('requiresMfa' in data && data.requiresMfa) {
      return data as MfaChallengeData;
    }

    const authData = data as AuthSuccessData;
    if (authData.tokens?.accessToken && authData.tokens?.refreshToken) {
      setStoredTokens(authData.tokens.accessToken, authData.tokens.refreshToken);
      setUser(authData.user);
    }
    return authData;
  };

  const register = async (payload: RegisterPatientPayload): Promise<AuthSuccessData> => {
    const response = await authApi.register(payload);
    return response.data;
  };

  const verifyMfa = async (payload: VerifyMfaPayload): Promise<AuthSuccessData> => {
    const response = await authApi.verifyMfaLogin(payload);
    const authData = response.data;
    if (authData.tokens?.accessToken && authData.tokens?.refreshToken) {
      setStoredTokens(authData.tokens.accessToken, authData.tokens.refreshToken);
      setUser(authData.user);
    }
    return authData;
  };

  const logout = async (): Promise<void> => {
    const refreshToken = getStoredRefreshToken();
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // Ignored: cleanup client state anyway
    } finally {
      clearStoredTokens();
      setUser(null);
    }
  };

  const refreshProfile = async (): Promise<void> => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        verifyMfa,
        logout,
        refreshProfile,
        refreshUser: refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
