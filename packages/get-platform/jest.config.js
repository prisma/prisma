module.exports = {
  transform: {
    '^.+\\.(m?j|t)s$': '@swc/jest',
  },
  transformIgnorePatterns: [],
  testEnvironment: 'node',
  collectCoverage: process.env.CI ? true : false,
  coverageReporters: ['clover'],
  coverageDirectory: 'src/__tests__/coverage',
  collectCoverageFrom: ['src/**/*.ts', '!**/__tests__/**/*'],
  testMatch: ['**/src/__tests__/**/*.test.ts'],
}
