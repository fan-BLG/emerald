import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@emerald/shared';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (token: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateBalance: (balance: number) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: true,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setToken: (token) => set({ token }),

      login: async (token: string) => {
        set({ isLoading: true });
        try {
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            set({
              user: data.data,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({ user: null, token: null, isAuthenticated: false, isLoading: false });
          }
        } catch (error) {
          console.error('Login error:', error);
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ isLoading: false });
          return;
        }

        set({ isLoading: true });
        try {
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            set({ user: data.data, isAuthenticated: true, isLoading: false });
          } else {
            set({ user: null, token: null, isAuthenticated: false, isLoading: false });
          }
        } catch (error) {
          console.error('Auth check error:', error);
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      },

      updateBalance: (balance: number) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, balance } });
        }
      },
    }),
    {
      name: 'emerald-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
