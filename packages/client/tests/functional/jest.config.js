const forceTranspile = require('../../../../helpers/jest/forceTranspile')

module.exports = {
  testMatch: [
    '**/*.ts',
    '!(**/*.d.ts)',
    '!(**/_utils/**)',
    '!(**/_matrix.ts)',
    '!(**/_schema.ts)',
    '!(**/.generated/**)',
  ],
  transform: {
    '^.+\\.(m?j|t)s$': '@swc/jest',
  },
  transformIgnorePatterns: [forceTranspile()],
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
  testTimeout: 10_000,
  collectCoverage: process.env.CI ? true : false,
}
