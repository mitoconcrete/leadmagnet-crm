export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface ApiFetchInit extends Omit<RequestInit, 'body'> {
  json?: unknown;
  body?: BodyInit;
}

interface ErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

/**
 * 관리자 API 호출 공통 래퍼.
 * - `credentials: 'include'`로 세션 쿠키(sid)를 동봉한다.
 * - `json`을 주면 `Content-Type: application/json` 헤더와 JSON 본문을 설정한다.
 * - 401이면 `/login`으로 이동시키고 ApiError를 던진다.
 * - 그 외 비-2xx 응답은 메시지를 담은 ApiError를 던진다.
 * - 204 응답은 undefined를 반환한다.
 */
export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const finalHeaders = new Headers(headers);
  let body = rest.body;

  if (json !== undefined) {
    finalHeaders.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }

  const res = await fetch(path, {
    ...rest,
    body,
    headers: finalHeaders,
    credentials: 'include',
  });

  if (res.status === 401) {
    // 이미 /login에 있다면(예: 로그인 실패) 재이동하지 않는다. 그 외에는 세션 만료로 보고 이동시킨다.
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
    throw new ApiError(401, '인증이 필요합니다');
  }

  if (!res.ok) {
    let message = res.statusText || '요청 처리 중 오류가 발생했습니다';
    try {
      const data = (await res.json()) as ErrorBody;
      if (Array.isArray(data.message)) {
        message = data.message.join(', ');
      } else if (typeof data.message === 'string') {
        message = data.message;
      }
    } catch {
      // 본문이 JSON이 아니면 기본 메시지를 유지한다.
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}
