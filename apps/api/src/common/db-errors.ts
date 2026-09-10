/** Postgres 외래키 위반(23503) 에러 코드. */
export const FOREIGN_KEY_VIOLATION_CODE = '23503';

/** Postgres 유니크 제약 위반(23505) 에러 코드. */
export const UNIQUE_VIOLATION_CODE = '23505';

/**
 * Postgres 외래키 위반(23503) 여부를 판별한다. 선조회(카운트) 이후 삭제 실행 사이에
 * 참조 행이 새로 생기는 TOCTOU 경합의 최후 방어로, 캠페인·템플릿 삭제 양쪽에서 쓴다.
 */
export function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === FOREIGN_KEY_VIOLATION_CODE;
}

/**
 * Postgres 유니크 제약 위반(23505) 여부를 판별한다. 템플릿 이름 중복 선조회(SELECT)
 * 이후 저장 사이에 같은 이름이 동시에 등록되는 경합의 최후 방어(ADR 0014)로 쓴다.
 */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === UNIQUE_VIOLATION_CODE;
}
