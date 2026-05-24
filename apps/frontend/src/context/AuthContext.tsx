import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";

export const AUTH_TOKEN_STORAGE_KEY = "auth_token";
export const AUTH_USER_ID_STORAGE_KEY = "userId";

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  role: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<{ email: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function persistSession(token: string, user: AuthUser): void {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(AUTH_USER_ID_STORAGE_KEY, user.id);
}

function clearSession(): void {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_USER_ID_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrate = useCallback(async () => {
    const stored = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!stored) {
      setToken(null);
      setUser(null);
      setIsLoading(false);
      return;
    }

    setToken(stored);
    try {
      const { data } = await api.get<{ user: AuthUser }>("/auth/me");
      setUser(data.user);
      window.localStorage.setItem(AUTH_USER_ID_STORAGE_KEY, data.user.id);
    } catch {
      clearSession();
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ user: AuthUser; token: string }>("/auth/login", { email, password });
    persistSession(data.token, data.user);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const { data } = await api.post<{ user: AuthUser; verificationEmailSent: boolean }>("/auth/register", {
      email,
      password,
      ...(name ? { name } : {}),
    });
    return { email: data.user.email };
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const stored = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!stored) {
      setToken(null);
      setUser(null);
      return;
    }

    setToken(stored);
    try {
      const { data } = await api.get<{ user: AuthUser }>("/auth/me");
      setUser(data.user);
      window.localStorage.setItem(AUTH_USER_ID_STORAGE_KEY, data.user.id);
    } catch {
      clearSession();
      setToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, login, register, logout, refreshUser }),
    [isLoading, login, logout, refreshUser, register, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
