module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: process.env.CI ? true : false,
  coverageReporters: ['clover'],
  coverageDirectory: 'src/__tests__/coverage',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!**/__tests__/**/*'],
}
