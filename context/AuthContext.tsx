import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, userApi } from '@/lib/api';
import { getAccessToken, saveTokens, clearTokens } from '@/lib/tokenStore';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string, username?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: { displayName?: string; username?: string; avatarUrl?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
                const stored = await AsyncStorage.getItem('user');
                const storedToken = await getAccessToken();
                if (stored && storedToken) {
                  setUser(JSON.parse(stored));
                  setToken(storedToken);
                }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persistAuth = useCallback(async (data: { user: User; accessToken: string; refreshToken: string }) => {
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        await saveTokens(data.accessToken, data.refreshToken);
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
    setUser(data.user);
    setToken(data.accessToken);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password) as any;
    await persistAuth(data);
  }, [persistAuth]);

  const register = useCallback(async (email: string, password: string, displayName?: string, username?: string) => {
    const data = await authApi.register(email, password, displayName, username) as any;
    await persistAuth(data);
  }, [persistAuth]);

  const logout = useCallback(async () => {
    // Start telling the server (it needs the refresh token, which is read
    // synchronously at the start of this call) but do NOT wait for it, so
    // signing out can never hang on the network.
    const serverLogout = authApi.logout().catch(() => {});
    // Clear the local session straight away.
    setUser(null);
    setToken(null);
    try {
      await AsyncStorage.multiRemove(['user', 'accessToken', 'refreshToken']);
    } catch {}
    // Give the server request a short head start to read the refresh token,
    // then remove the stored tokens. Never wait longer than 1.5 s.
    await Promise.race([serverLogout, new Promise((resolve) => setTimeout(resolve, 1500))]);
    try {
      await clearTokens();
    } catch {}
  }, []);

  const updateUser = useCallback(async (data: { displayName?: string; username?: string; avatarUrl?: string }) => {
    const updated = await userApi.updateMe(data) as User;
    const merged = { ...user, ...updated } as User;
    await AsyncStorage.setItem('user', JSON.stringify(merged));
    setUser(merged);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}