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

  it('409 응답의 details를 ApiError에 보존한다', async () => {
    const details = { forms: 1, visits: 1, submissions: 1 };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: 409,
            message: '사용 중인 템플릿입니다(폼 1개, 방문 1건, 신청 1건)',
            error: 'Conflict',
            details,
          }),
          { status: 409 },
        ),
      ),
    );

    await expect(apiFetch('/api/admin/templates/t1')).rejects.toMatchObject({
      status: 409,
      details,
    });
  });

  it('details가 없는 오류 응답은 ApiError.details가 undefined다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ statusCode: 400, message: '오류', error: 'Bad Request' }), { status: 400 }),
      ),
    );

    await expect(apiFetch('/api/admin/templates')).rejects.toMatchObject({ details: undefined });
  });

  it('message가 배열이면 join한 문자열을 message로, 원본 배열을 messages에 보존한다(ADR 0018 차단 규칙)', async () => {
    const reasons = ['관리자 API 참조(/api/admin)가 포함되어 있습니다', '쿠키 접근(document.cookie)이 포함되어 있습니다'];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ statusCode: 400, message: reasons, error: 'Bad Request' }), { status: 400 }),
      ),
    );

    await expect(apiFetch('/api/admin/templates', { method: 'POST' })).rejects.toMatchObject({
      status: 400,
      message: reasons.join(', '),
      messages: reasons,
    });
  });

  it('message가 문자열이면 messages는 undefined다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ statusCode: 400, message: '오류', error: 'Bad Request' }), { status: 400 }),
      ),
    );

    await expect(apiFetch('/api/admin/templates')).rejects.toMatchObject({ messages: undefined });
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
