'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, setToken } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(errorParam);
      return;
    }

    if (token) {
      // Store token
      localStorage.setItem('token', token);
      setToken(token);

      // Fetch user data
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setUser(data.data);
            router.push('/');
          } else {
            setError('Failed to fetch user data');
          }
        })
        .catch(() => {
          setError('Failed to authenticate');
        });
    } else {
      setError('No token received');
    }
  }, [searchParams, router, setUser, setToken]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-dark-card p-8 rounded-lg text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Authentication Error</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Authenticating with Steam...</p>
      </div>
    </div>
  );
}
