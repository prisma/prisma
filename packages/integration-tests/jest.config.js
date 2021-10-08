module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  collectCoverage: process.env.CI ? true : false,
  coverageReporters: ['clover'],
  coverageDirectory: 'src/__tests__/coverage',
  collectCoverageFrom: ['src/**/*.ts', '!**/__tests__/**/*'],
  // todo duplicated serializer from client package, should share
  snapshotSerializers: ['./src/__tests__/__helpers__/snapshotSerializer.ts'],
  // setupFiles: ['./src/__tests__/__helpers__/segfaultHandler.ts'],
}
