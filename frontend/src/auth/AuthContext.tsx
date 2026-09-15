import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchCurrentUser, login as loginRequest, logout as logoutRequest, type UserOut } from "../api/auth";
import { tokenStorage } from "../lib/storage";

interface AuthContextValue {
  user: UserOut | null;
  isLoading: boolean;
  login: (tenantSlug: string, email: string, password: string) => Promise<UserOut>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tokenStorage.getAccessToken()) {
      setIsLoading(false);
      return;
    }
    fetchCurrentUser()
      .then(setUser)
      .catch(() => tokenStorage.clear())
      .finally(() => setIsLoading(false));
  }, []);

  async function login(tenantSlug: string, email: string, password: string) {
    const tokens = await loginRequest(tenantSlug, email, password);
    tokenStorage.setTokens(tokens.access_token, tokens.refresh_token);
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);
    return currentUser;
  }

  async function logout() {
    try {
      // Best-effort: bumps the user's token_version server-side so every outstanding
      // access/refresh token is invalidated immediately, not just cleared on this device.
      await logoutRequest();
    } catch {
      // Already-expired session, offline, etc. — clearing local state below is enough.
    } finally {
      tokenStorage.clear();
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
