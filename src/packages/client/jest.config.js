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
  ],
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
  snapshotSerializers: ['./scripts/jestSnapshotSerializer'],
}
