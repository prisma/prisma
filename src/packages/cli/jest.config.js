module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/src/__tests__/doctor*',
    '**/src/__tests__/format*',
    '**/src/__tests__/dotenv*',
    '**/src/__tests__/generate*',
    '**/src/__tests__/studio*',
    '**/src/__tests__/integration*',
    '**/src/__tests__/introspect*',
  ],
  // todo duplicated serializer from client package, should share
  snapshotSerializers: ['./src/__tests__/__helpers__/snapshotSerializer.ts'],
}
