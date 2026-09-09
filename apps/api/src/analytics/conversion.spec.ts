import { conversionRate } from './conversion';

describe('conversionRate', () => {
  it('visitors가 0이면 0을 반환한다', () => {
    expect(conversionRate(0, 0)).toBe(0);
    expect(conversionRate(5, 0)).toBe(0);
  });

  it('1/3은 소수 4자리로 반올림해 0.3333이다', () => {
    expect(conversionRate(1, 3)).toBe(0.3333);
  });

  it('2/2는 1이다', () => {
    expect(conversionRate(2, 2)).toBe(1);
  });
});
