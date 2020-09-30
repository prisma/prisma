module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
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
    '__tests__/fixtures',
    'exhaustive-schema/generated-dmmf.ts'
  ],
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
  snapshotSerializers: ['./helpers/jestSnapshotSerializer'],
  testTimeout: 10000
}
