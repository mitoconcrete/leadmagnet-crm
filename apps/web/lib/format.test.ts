import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDateKST, formatRate } from './format';

describe('formatRate', () => {
  it('0.3333을 33.3%로 표시한다', () => {
    expect(formatRate(0.3333)).toBe('33.3%');
  });

  it('0을 0.0%로 표시한다', () => {
    expect(formatRate(0)).toBe('0.0%');
  });

  it('1을 100.0%로 표시한다', () => {
    expect(formatRate(1)).toBe('100.0%');
  });
});

describe('formatDateKST', () => {
  it('UTC ISO 문자열을 Asia/Seoul 기준 YYYY-MM-DD HH:mm으로 표시한다', () => {
    // UTC 2026-01-01T00:00:00Z -> KST 2026-01-01T09:00:00+09:00
    expect(formatDateKST('2026-01-01T00:00:00.000Z')).toBe('2026-01-01 09:00');
  });

  it('자정 경계를 넘어가는 시각도 올바르게 표시한다', () => {
    // UTC 2026-01-01T15:30:00Z -> KST 2026-01-02T00:30:00+09:00
    expect(formatDateKST('2026-01-01T15:30:00.000Z')).toBe('2026-01-02 00:30');
  });

  it('ICU가 자정을 24시로 표기해도 00시로 정규화한다', () => {
    const OriginalFormatToParts = Intl.DateTimeFormat.prototype.formatToParts;
    vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockImplementation(function (
      this: Intl.DateTimeFormat,
      ...args: Parameters<typeof OriginalFormatToParts>
    ) {
      return OriginalFormatToParts.apply(this, args).map((part) =>
        part.type === 'hour' ? { ...part, value: '24' } : part,
      );
    });

    // 실제 KST 시각은 09:00이지만, ICU가 '24'로 표기하는 상황을 모킹해 정규화 분기를 검증한다.
    expect(formatDateKST('2026-01-01T00:00:00.000Z')).toBe('2026-01-01 00:00');
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
