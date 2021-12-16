module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  collectCoverage: process.env.CI ? true : false,
  coverageReporters: ['clover'],
  coverageDirectory: 'src/__tests__/coverage',
  collectCoverageFrom: ['src/**/*.ts', '!**/__tests__/**/*'],
  coveragePathIgnorePatterns: [
    'bin.ts',
    'setupMysql.ts',
    'setupPostgres.ts',
    'test-MigrateEngineCommands.ts',
    'test-handlePanic.ts',
    'test-interactivelyCreateDatabase.ts',
  ],
  // todo duplicated serializer from client package, should share
  snapshotSerializers: ['./src/__tests__/__helpers__/snapshotSerializer.ts'],
  // to get rid of "jest-haste-map: Haste module naming collision: package name"
  modulePathIgnorePatterns: ['<rootDir>/src/__tests__/fixtures/'],
}
