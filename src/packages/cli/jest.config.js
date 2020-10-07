module.exports = {
  preset: 'ts-jest',
  testTimeout: 20_000,
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'src/__tests__/coverage',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  // todo duplicated serializer from client package, should share
  snapshotSerializers: ['./src/__tests__/__helpers__/snapshotSerializer.ts'],
}
