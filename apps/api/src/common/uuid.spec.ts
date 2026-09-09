import { isUuid } from './uuid';

describe('isUuid', () => {
  it('표준 UUID 형식이면 true다', () => {
    expect(isUuid('11111111-1111-1111-1111-111111111111')).toBe(true);
  });

  it('대문자 UUID도 true다', () => {
    expect(isUuid('AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE')).toBe(true);
  });

  it('형식이 아니면 false다', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(123)).toBe(false);
  });
});
