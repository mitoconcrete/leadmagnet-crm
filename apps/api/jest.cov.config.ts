import type { Config } from 'jest';
const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/openapi-export.ts',
    '!src/migrations/**',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: { global: { lines: 90, statements: 90, functions: 90, branches: 80 } },
};
export default config;
