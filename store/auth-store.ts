import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface User {
  id: string;
  email?: string;
  name?: string;
}

interface AuthState {
  // Auth state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        // Actions
        setUser: (user: User | null) =>
          set(
            { user, isAuthenticated: !!user, error: null },
            false,
            'auth/setUser'
          ),

        setLoading: (isLoading: boolean) =>
          set({ isLoading }, false, 'auth/setLoading'),

        setError: (error: string | null) =>
          set({ error }, false, 'auth/setError'),

        logout: () =>
          set(
            { user: null, isAuthenticated: false, error: null },
            false,
            'auth/logout'
          ),

        clearError: () =>
          set({ error: null }, false, 'auth/clearError'),
      }),
      {
        name: 'auth-store',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    {
      name: 'auth-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);