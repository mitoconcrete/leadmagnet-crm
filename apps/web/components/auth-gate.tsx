'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

type Status = 'loading' | 'ready' | 'error';

/**
 * 마운트 시 GET /api/admin/auth/me로 세션을 확인한다.
 * 401이면 apiFetch가 /login으로 이동시킨다. 확인 전에는 스켈레톤을 보여준다.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let active = true;
    apiFetch('/api/admin/auth/me')
      .then(() => {
        if (active) setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (status === 'error') {
    return null;
  }

  return <>{children}</>;
}
