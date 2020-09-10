module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/src/__tests__/doctor.test.ts',
    '**/src/__tests__/format.test.ts',
  ],
  snapshotSerializers: ['./src/__tests__/__helpers__/snapshotSerializer.ts'],
}
