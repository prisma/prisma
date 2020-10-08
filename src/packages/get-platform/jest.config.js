module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'src/__tests__/coverage',
  collectCoverageFrom: ['src/**/*.ts', '!**/__tests__/**/*'],
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
}
