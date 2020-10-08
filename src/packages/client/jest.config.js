module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
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
  ],
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
  snapshotSerializers: ['./helpers/jestSnapshotSerializer'],
  testTimeout: 10000,
}
