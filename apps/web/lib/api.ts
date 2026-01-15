import { useAuthStore } from '@/stores/authStore';
import type { ApiResponse } from '@emerald/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeaders(): HeadersInit {
    const token = useAuthStore.getState().token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<ApiResponse<T>> {
    const { params, ...fetchOptions } = options;
    const url = this.buildUrl(endpoint, params);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
          ...fetchOptions.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || { code: 'UNKNOWN_ERROR', message: 'An error occurred' },
        };
      }

      return data;
    } catch (error) {
      console.error('API fetch error:', error);
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: 'Network error occurred' },
      };
    }
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
    return this.fetch<T>(endpoint, { method: 'GET', params });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.fetch<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.fetch<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.fetch<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_URL);

// Typed API methods
export const apiRoutes = {
  // Auth
  auth: {
    me: () => api.get('/api/auth/me'),
    logout: () => api.post('/api/auth/logout'),
  },

  // Users
  users: {
    get: (id: string) => api.get(`/api/users/${id}`),
    updateSettings: (data: unknown) => api.put('/api/users/settings', data),
    updateClientSeed: (clientSeed: string) => api.put('/api/users/client-seed', { clientSeed }),
    transactions: (params?: { page?: number; limit?: number }) =>
      api.get('/api/users/transactions', params),
  },

  // Cases
  cases: {
    list: (params?: { featured?: boolean; category?: string; sort?: string; page?: number; limit?: number }) =>
      api.get('/api/cases', params),
    get: (id: string) => api.get(`/api/cases/${id}`),
    open: (id: string, count: number = 1) => api.post(`/api/cases/${id}/open`, { count }),
  },

  // Battles
  battles: {
    list: (params?: {
      status?: string;
      type?: string;
      mode?: string;
      minPrice?: number;
      maxPrice?: number;
      sort?: string;
      page?: number;
      limit?: number;
    }) => api.get('/api/battles', params),
    get: (id: string) => api.get(`/api/battles/${id}`),
    create: (data: unknown) => api.post('/api/battles', data),
    join: (id: string, position: number, team?: number) =>
      api.post(`/api/battles/${id}/join`, { position, team }),
    leave: (id: string) => api.post(`/api/battles/${id}/leave`),
    cancel: (id: string) => api.delete(`/api/battles/${id}`),
    random: (budget: number, minCases: number) =>
      api.post('/api/battles/random', { budget, minCases }),
    verify: (id: string) => api.get(`/api/battles/${id}/verify`),
  },

  // Payments
  payments: {
    currencies: () => api.get('/api/payments/currencies'),
    createDeposit: (amount: number, currency: string) =>
      api.post('/api/payments/deposit', { amount, currency }),
    getDeposit: (id: string) => api.get(`/api/payments/deposit/${id}`),
  },

  // Withdrawals
  withdrawals: {
    searchSkins: (params?: { query?: string; minPrice?: number; maxPrice?: number }) =>
      api.get('/api/withdrawals/skins', params),
    request: (waxpeerItemId: string, tradeLink: string) =>
      api.post('/api/withdrawals/request', { waxpeerItemId, tradeLink }),
    get: (id: string) => api.get(`/api/withdrawals/${id}`),
    history: () => api.get('/api/withdrawals/history'),
  },

  // Provably Fair
  fair: {
    seeds: () => api.get('/api/fair/seeds'),
    rotate: () => api.post('/api/fair/seeds/rotate'),
    verify: (gameId: string) => api.get(`/api/fair/verify/${gameId}`),
  },

  // Leaderboards
  leaderboard: {
    daily: () => api.get('/api/leaderboard/daily'),
    weekly: () => api.get('/api/leaderboard/weekly'),
    monthly: () => api.get('/api/leaderboard/monthly'),
  },

  // Chat
  chat: {
    history: (room: string, params?: { before?: number; limit?: number }) =>
      api.get(`/api/chat/${room}/history`, params),
  },
};
