module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['dist/', 'fixtures/', '__helpers__/'],
  // todo duplicated serializer from client package, should share
  snapshotSerializers: ['./src/__tests__/__helpers__/snapshotSerializer.ts'],
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
}
