/** @type {import('jest').Config} */
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  testTimeout: 180_000,
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        diagnostics: { ignoreCodes: [151001] },
      },
    ],
  },
  moduleNameMapper: {
    '^@lims/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  clearMocks: false,
};
