import { slugify, randomSuffix } from './slug';

describe('slugify', () => {
  it('영문은 소문자로 바꾸고 공백은 하이픈으로 바꾼다', () => {
    expect(slugify('Summer Sale')).toBe('summer-sale');
  });

  it('한글과 영숫자는 유지한다', () => {
    expect(slugify('여름 세일 2026')).toBe('여름-세일-2026');
  });

  it('특수문자는 제거한다', () => {
    expect(slugify('Hello, World! @2026')).toBe('hello-world-2026');
  });

  it('빈 값이면 form을 반환한다', () => {
    expect(slugify('')).toBe('form');
    expect(slugify('!!!')).toBe('form');
  });
});

describe('randomSuffix', () => {
  it('기본 길이는 4자다', () => {
    expect(randomSuffix()).toHaveLength(4);
  });

  it('길이를 지정할 수 있다', () => {
    expect(randomSuffix(8)).toHaveLength(8);
  });

  it('소문자·숫자로만 구성된다', () => {
    expect(randomSuffix(20)).toMatch(/^[a-z0-9]+$/);
  });
});
