module.exports = {
  transform: {
    '^.+\\.ts$': '@swc/jest',
  },
  testEnvironment: 'node',
  testMatch: ['**/src/tests/**/*.test.ts'],
  collectCoverage: process.env.CI ? true : false,
  coverageReporters: ['clover'],
  coverageDirectory: 'src/tests/coverage',
  collectCoverageFrom: ['src/**/*.ts', '!**/tests/**/*'],
  snapshotSerializers: ['@prisma/internals/src/utils/jestSnapshotSerializer'],
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
