module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'src/__tests__/coverage',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  // modulePathIgnorePatterns: ['build/', 'dist/', 'generator/', 'runtime/'],
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
}
