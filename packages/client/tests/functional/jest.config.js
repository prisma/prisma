'use strict'

module.exports = {
  testMatch: ['**/*.ts', '!(**/*.d.ts)', '!(**/_utils/**)', '!(**/_*.ts)', '!(**/.generated/**)'],
  transform: {
    '^.+\\.(m?j|t)s$': '@swc/jest',
  },
  transformIgnorePatterns: [],
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
  globalSetup: './_utils/globalSetup.js',
  snapshotSerializers: ['@prisma/internals/src/utils/jestSnapshotSerializer'],
  setupFilesAfterEnv: ['./_utils/setupFilesAfterEnv.ts'],
  testTimeout: 60000,
  collectCoverage: process.env.CI ? true : false,
}
