module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: process.env.CI ? true : false,
  coverageReporters: ['clover'],
  coverageDirectory: 'src/__tests__/coverage',
  modulePathIgnorePatterns: [
    'build/',
    'dist/',
    'generator/',
    'runtime/',
    '@prisma',
    'index.ts',
    'index.js',
    'stack.js',
    'runner.js',
    'node_modules/',
    'exhaustive-schema/generated-dmmf.ts',
    '__helpers__'
  ],
  snapshotSerializers: ['./helpers/jestSnapshotSerializer'],
  testTimeout: 10000,
  setupFiles: ['./helpers/jestSetup.js']
}
