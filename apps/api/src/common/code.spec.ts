import { generateCode } from './code';

describe('generateCode', () => {
  it('기본 길이는 8자다', () => {
    expect(generateCode()).toHaveLength(8);
  });

  it('base62 문자만 포함한다', () => {
    expect(generateCode(50)).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it('길이를 지정할 수 있다', () => {
    expect(generateCode(12)).toHaveLength(12);
  });
});
