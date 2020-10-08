module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'src/__tests__/coverage',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!**/__tests__/**/*'],
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
}
