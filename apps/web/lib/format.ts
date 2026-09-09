/**
 * 전환율(0.0~1.0)을 소수 1자리 % 문자열로 표시한다.
 * 예: 0.3333 -> '33.3%'
 */
export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * ISO 8601(UTC) 문자열을 Asia/Seoul 기준 'YYYY-MM-DD HH:mm'으로 표시한다.
 */
export function formatDateKST(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';

  // 일부 ICU 구현은 자정을 hour12:false에서 '24'로 표시한다.
  const hour = get('hour') === '24' ? '00' : get('hour');

  return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}`;
}

/**
 * Date를 Asia/Seoul 기준 'HH:mm:ss'로 표시한다.
 */
export function formatTimeKST(date: Date): string {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';

  // 일부 ICU 구현은 자정을 hour12:false에서 '24'로 표시한다.
  const hour = get('hour') === '24' ? '00' : get('hour');

  return `${hour}:${get('minute')}:${get('second')}`;
}
