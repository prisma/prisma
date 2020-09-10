module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/src/__tests__/doctor*',
    '**/src/__tests__/format*',
    '**/src/__tests__/dotenv-1*',
    '**/src/__tests__/dotenv-2*',
    '**/src/__tests__/dotenv-3*',
    '**/src/__tests__/dotenv-4*',
    '**/src/__tests__/dotenv-5*',
    '**/src/__tests__/generate*',
  ],
  // todo duplicated serializer from client package, should share
  snapshotSerializers: ['./src/__tests__/__helpers__/snapshotSerializer.ts'],
}
