module.exports = {
  transform: {
    '^.+\\.ts$': '@swc/jest',
  },
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts'],
  collectCoverage: process.env.CI ? true : false,
  coverageReporters: ['clover'],
  coverageDirectory: 'src/__tests__/coverage',
  collectCoverageFrom: ['src/**/*.ts', '!**/__tests__/**/*'],
  snapshotSerializers: ['@prisma/sdk/src/utils/jestSnapshotSerializer'],
  reporters: [
    'default',
    [
      'jest-junit',
      {
        addFileAttribute: 'true',
        ancestorSeparator: ' › ',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
      },
    ],
  ],
}
