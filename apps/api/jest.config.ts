import type { Config } from 'jest';
const config: Config = {
  rootDir: 'src', testRegex: '.*\\.spec\\.ts$', transform: { '^.+\\.ts$': 'ts-jest' },
  moduleFileExtensions: ['js', 'json', 'ts'], testEnvironment: 'node',
};
export default config;
