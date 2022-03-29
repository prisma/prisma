module.exports = {
  testMatch: ['**/*.ts', '!(**/*.d.ts)', '!(**/_utils/**)', '!(**/_matrix.ts)', '!(**/.generated/**)'],
  transform: { '^.+\\.(t|j)sx?$': '@swc/jest' },
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
  snapshotSerializers: ['@prisma/sdk/src/utils/jestSnapshotSerializer'],
  setupFilesAfterEnv: ['./_utils/setupFilesAfterEnv.ts'],
  testTimeout: 10000,
  collectCoverage: process.env.CI ? true : false,
}
