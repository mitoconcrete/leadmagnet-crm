import { describe, expect, it } from 'vitest';
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
});
