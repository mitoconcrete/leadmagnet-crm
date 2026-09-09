import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import { usePolling } from './use-polling';
import { POLL_INTERVAL_MS } from '@/lib/polling';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

/** 대기 중인 마이크로태스크·타이머를 흘려보낸다(가짜 타이머 환경에서 waitFor 대신 사용). */
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('마운트 시 즉시 한 번 fetcher를 호출하고 data를 채운다', async () => {
    const fetcher = vi.fn().mockResolvedValue('a');
    const { result } = renderHook(() => usePolling(fetcher));

    await flush();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe('a');
  });

  it('30초 간격마다 다시 호출한다', async () => {
    const fetcher = vi.fn().mockResolvedValue('a');
    renderHook(() => usePolling(fetcher));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('탭이 hidden이면 폴링을 멈추고, 다시 visible이 되면 즉시 한 번 갱신 후 재개한다', async () => {
    const fetcher = vi.fn().mockResolvedValue('a');
    renderHook(() => usePolling(fetcher));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('실패하면 이전 data를 유지하고 error를 설정하며 첫 실패에만 토스트를 띄운다', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('a').mockRejectedValue(new Error('실패'));
    const { result } = renderHook(() => usePolling(fetcher));
    await flush();
    expect(result.current.data).toBe('a');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(result.current.data).toBe('a');
    expect(result.current.error).toBeTruthy();
    expect(toast.error).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(result.current.data).toBe('a');
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('성공 시에만 lastUpdatedAt을 갱신한다', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('a').mockRejectedValue(new Error('실패'));
    const { result } = renderHook(() => usePolling(fetcher));
    await flush();
    const first = result.current.lastUpdatedAt;
    expect(first).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(result.current.lastUpdatedAt).toBe(first);
  });

  it('언마운트 후 응답이 와도 상태를 갱신하지 않는다', async () => {
    let resolveFn: (value: string) => void = () => {};
    const fetcher = vi.fn().mockReturnValue(
      new Promise<string>((resolve) => {
        resolveFn = resolve;
      }),
    );
    const { unmount } = renderHook(() => usePolling(fetcher));
    unmount();
    resolveFn('a');

    await flush();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('refresh()로 수동 갱신할 수 있다', async () => {
    const fetcher = vi.fn().mockResolvedValue('a');
    const { result } = renderHook(() => usePolling(fetcher));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('겹치는 요청 중 먼저 시작한 요청이 나중에 끝나도 최신 요청의 응답을 덮어쓰지 않는다', async () => {
    let resolveFirst: (value: string) => void = () => {};
    let resolveSecond: (value: string) => void = () => {};
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { result } = renderHook(() => usePolling(fetcher));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);

    act(() => {
      void result.current.refresh();
    });
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);

    // 두 번째(최신) 요청이 먼저 끝난다.
    resolveSecond('second');
    await flush();
    expect(result.current.data).toBe('second');

    // 첫 번째(오래된) 요청이 뒤늦게 끝나도 최신 데이터를 덮지 않는다.
    resolveFirst('first');
    await flush();
    expect(result.current.data).toBe('second');
    expect(result.current.isRefreshing).toBe(false);
  });
});
