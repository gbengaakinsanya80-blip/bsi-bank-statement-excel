"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { clearSession, getToken, setSession, type AuthUser } from "@/lib/auth";
import { fetchMe, login as apiLogin, register as apiRegister } from "@/lib/api";

type AuthContextValue = {
  user: AuthUser | null;
  initializing: boolean;
  login: (email: string, password: string, next?: string) => Promise<void>;
  register: (email: string, password: string, next?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [initializing, setInitializing] = React.useState(true);

  React.useEffect(() => {
    if (!getToken()) {
      setInitializing(false);
      return;
    }
    // Validate the stored token against the backend.
    fetchMe()
      .then((u) => setUser(u))
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setInitializing(false));
  }, []);

  React.useEffect(() => {
    if (initializing) return;
    if (user) return;
    if (pathname === "/login") return;
    // App is behind the login wall: send unauthenticated visitors to sign in.
    const next = pathname + window.location.search;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [initializing, user, pathname, router]);

  const login = React.useCallback(
    async (email: string, password: string, next?: string) => {
      const { token, user: u } = await apiLogin(email, password);
      setSession(token, u);
      setUser(u);
      router.push(next || "/");
      router.refresh();
    },
    [router],
  );

  const register = React.useCallback(
    async (email: string, password: string, next?: string) => {
      const { token, user: u } = await apiRegister(email, password);
      setSession(token, u);
      setUser(u);
      router.push(next || "/");
      router.refresh();
    },
    [router],
  );

  const logout = React.useCallback(() => {
    clearSession();
    setUser(null);
    router.push("/login");
    router.refresh();
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, initializing, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
