"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { apiFetch, clearToken, getToken, setToken } from "@/lib/api";
import type { AuthResponse, User } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; password: string; display_name: string; handedness: "right" | "left" }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await apiFetch<User>("/api/auth/me"));
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!loading && pathname.startsWith("/app") && !user) router.replace("/login");
  }, [loading, pathname, router, user]);

  async function login(email: string, password: string) {
    const response = await apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(response.access_token);
    setUser(response.user);
    router.push("/app");
  }

  async function register(payload: { email: string; password: string; display_name: string; handedness: "right" | "left" }) {
    const response = await apiFetch<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setToken(response.access_token);
    setUser(response.user);
    router.push("/app");
  }

  function logout() {
    clearToken();
    setUser(null);
    router.push("/");
  }

  const value = useMemo(() => ({ user, loading, login, register, logout, refresh }), [user, loading, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
