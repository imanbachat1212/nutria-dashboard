import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, setToken, clearToken, getToken } from "./api";

interface AuthUser {
  _id: string;
  email: string;
  name: string;
  role: { name: string; permissions: string[] };
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /**
   * Does the signed-in user hold this permission? (prompt-125)
   *
   * The permission list already arrives with /api/auth/me — it was simply never read, so every
   * nav item and every page rendered for everyone regardless of role. This is the UI half of the
   * gate ONLY: the backend enforces the same keys on every route, and a page hidden here is still
   * refused there. Hiding a control the server would reject is a courtesy, not the control.
   */
  can: (permission: string) => boolean;
  /** Signs a user in from an invite acceptance, which returns the same { token, user } as login. */
  adoptSession: (token: string, user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<AuthUser>("/api/auth/me")
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<{ token: string; user: AuthUser }>(
      "/api/auth/login",
      { email, password },
    );
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  // Accepting an invite returns a token and a user exactly as login does; storing them through
  // the same two calls means there is one definition of "signed in", not two that can drift.
  const adoptSession = useCallback((token: string, nextUser: AuthUser) => {
    setToken(token);
    setUser(nextUser);
  }, []);

  const can = useCallback(
    (permission: string) => {
      const held = user?.role?.permissions;
      if (!held) return false;
      // "*" is the internal SERVICE_API_KEY's wildcard (middleware/auth.js). A human never has it,
      // but honouring it here keeps this helper truthful about what the backend would allow.
      return held.includes("*") || held.includes(permission);
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can, adoptSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
