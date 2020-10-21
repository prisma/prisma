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
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
  snapshotSerializers: ['./helpers/jestSnapshotSerializer'],
  testTimeout: 10000,
}
