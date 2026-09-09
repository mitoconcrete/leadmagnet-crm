import { Provider, Type } from '@nestjs/common';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';

type EntityClassOrSchema = Type<unknown>;

/**
 * DOCS_ONLY=1일 때는 DatabaseModule을 연결하지 않고 컨트롤러 메타데이터만으로
 * OpenAPI 문서를 생성한다(B8, openapi-export.ts). TypeOrmModule.forFeature가
 * 등록하는 리포지토리 프로바이더를 대체할 더미 프로바이더를 만들어 DI 해석이
 * DB 연결 없이도 성공하도록 한다. 런타임 조회는 하지 않으므로 안전하다.
 */
export const isDocsOnly = (): boolean => process.env.DOCS_ONLY === '1';

export function stubRepositoryProviders(entities: EntityClassOrSchema[]): Provider[] {
  return entities.map((entity) => ({ provide: getRepositoryToken(entity), useValue: {} }));
}

export function stubDataSourceProvider(): Provider {
  return { provide: getDataSourceToken(), useValue: {} };
}
