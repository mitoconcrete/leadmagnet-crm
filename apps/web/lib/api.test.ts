import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from './api';

describe('apiFetch', () => {
  let assignMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    assignMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, assign: assignMock },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('401 응답이면 /login으로 이동시키고 ApiError를 던진다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' }), {
          status: 401,
        }),
      ),
    );

    await expect(apiFetch('/api/admin/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(assignMock).toHaveBeenCalledWith('/login');
  });

  it('400 응답이면 message를 담은 ApiError를 던진다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ statusCode: 400, message: '이메일 또는 비밀번호가 올바르지 않습니다', error: 'Bad Request' }),
          { status: 400 },
        ),
      ),
    );

    await expect(apiFetch('/api/admin/auth/login')).rejects.toMatchObject({
      status: 400,
      message: '이메일 또는 비밀번호가 올바르지 않습니다',
    });
  });

  it('요청은 credentials: include로 전송된다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/admin/campaigns');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/campaigns',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('json 옵션을 주면 Content-Type과 body를 설정한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/admin/campaigns', { method: 'POST', json: { name: '캠페인' } });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.body).toBe(JSON.stringify({ name: '캠페인' }));
    expect(options.headers.get('Content-Type')).toBe('application/json');
  });

  it('204 응답이면 undefined를 반환한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(apiFetch('/api/admin/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('이미 /login 경로에 있으면 401이어도 재이동하지 않고 ApiError만 던진다', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, assign: assignMock, pathname: '/login' },
      writable: true,
      configurable: true,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ statusCode: 401, message: '인증이 필요합니다', error: 'Unauthorized' }), {
          status: 401,
        }),
      ),
    );

    await expect(apiFetch('/api/admin/auth/login')).rejects.toMatchObject({ status: 401 });
    expect(assignMock).not.toHaveBeenCalled();
  });
});
