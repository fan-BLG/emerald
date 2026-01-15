'use client';

import { ReactNode, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const { checkAuth } = useAuthStore();
  const { connect, disconnect } = useSocketStore();

  useEffect(() => {
    // Check authentication on mount
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // Connect to socket when authenticated
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return <>{children}</>;
}
