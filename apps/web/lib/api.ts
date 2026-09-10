export class ApiError extends Error {
  status: number;
  /** 409 등 오류 응답의 details 필드(예: {forms, visits, submissions}). 없으면 undefined. */
  details?: unknown;
  /**
   * 서버 message가 배열이었을 때의 원본 배열(예: ADR 0018 등록 차단 규칙 이유 목록).
   * message는 항상 string(join된 값)이어야 하므로, 화면이 이유를 목록으로 보여줘야
   * 하면 이 필드를 쓴다. message가 문자열이면 undefined.
   */
  messages?: string[];

  constructor(status: number, message: string, details?: unknown, messages?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.messages = messages;
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
  details?: unknown;
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
    let details: unknown;
    let messages: string[] | undefined;
    try {
      const data = (await res.json()) as ErrorBody;
      if (Array.isArray(data.message)) {
        message = data.message.join(', ');
        messages = data.message;
      } else if (typeof data.message === 'string') {
        message = data.message;
      }
      details = data.details;
    } catch {
      // 본문이 JSON이 아니면 기본 메시지를 유지한다.
    }
    throw new ApiError(res.status, message, details, messages);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}
