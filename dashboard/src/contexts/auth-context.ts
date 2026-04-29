import { createContext } from "react";

export interface AuthContextType {
  user: { id: string; name: string; email: string } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);
