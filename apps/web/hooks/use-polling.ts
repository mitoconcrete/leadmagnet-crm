'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { POLL_INTERVAL_MS } from '@/lib/polling';

export interface UsePollingResult<T> {
  data: T | null;
  error: unknown;
  lastUpdatedAt: Date | null;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
}

/**
 * fetcher를 마운트 즉시 1회, 이후 intervalMs 간격으로 반복 호출한다(ADR 0016).
 * - 탭이 보이지 않으면(document.hidden) 타이머를 멈추고, 다시 보이면 즉시 1회 갱신 후 재개한다.
 * - 실패해도 이전 data는 유지하고 error만 설정한다. 토스트는 연속 실패 첫 회에만 띄운다.
 * - 언마운트 후에는 상태를 갱신하지 않는다.
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs = POLL_INTERVAL_MS): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const mountedRef = useRef(true);
  const hasErroredRef = useRef(false);

  const run = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await fetcherRef.current();
      if (!mountedRef.current) return;
      setData(result);
      setError(null);
      setLastUpdatedAt(new Date());
      hasErroredRef.current = false;
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err);
      if (!hasErroredRef.current) {
        hasErroredRef.current = true;
        toast.error(err instanceof ApiError ? err.message : '데이터를 불러오지 못했습니다');
      }
    } finally {
      if (mountedRef.current) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void run();

    let intervalId: ReturnType<typeof setInterval> | null = null;

    function startInterval() {
      if (intervalId !== null) return;
      intervalId = setInterval(() => {
        void run();
      }, intervalMs);
    }

    function stopInterval() {
      if (intervalId === null) return;
      clearInterval(intervalId);
      intervalId = null;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        stopInterval();
      } else {
        void run();
        startInterval();
      }
    }

    startInterval();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, run]);

  return { data, error, lastUpdatedAt, isRefreshing, refresh: run };
}
