module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  // todo duplicated serializer from client package, should share
  snapshotSerializers: ['./src/__tests__/__helpers__/snapshotSerializer.ts'],
}
