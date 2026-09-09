import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { isDocsOnly, stubDataSourceProvider, stubRepositoryProviders } from './docs-only';

class Dummy {}

describe('docs-only', () => {
  const original = process.env.DOCS_ONLY;
  afterEach(() => {
    process.env.DOCS_ONLY = original;
  });

  it('DOCS_ONLY=1일 때 true를 반환한다', () => {
    process.env.DOCS_ONLY = '1';
    expect(isDocsOnly()).toBe(true);
  });

  it('DOCS_ONLY가 아니면 false를 반환한다', () => {
    delete process.env.DOCS_ONLY;
    expect(isDocsOnly()).toBe(false);
  });

  it('stubRepositoryProviders는 각 엔티티의 리포지토리 토큰에 더미 값을 제공한다', () => {
    const providers = stubRepositoryProviders([Dummy]);
    expect(providers).toEqual([{ provide: getRepositoryToken(Dummy), useValue: {} }]);
  });

  it('stubDataSourceProvider는 DataSource 토큰에 더미 값을 제공한다', () => {
    expect(stubDataSourceProvider()).toEqual({ provide: getDataSourceToken(), useValue: {} });
  });
});
