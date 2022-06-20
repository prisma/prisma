module.exports = {
  testMatch: [
    '**/*.ts',
    '!(**/*.d.ts)',
    '!(**/_utils/**)',
    '!(**/_matrix.ts)',
    '!(**/_schema.ts)',
    '!(**/.generated/**)',
  ],
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
  snapshotSerializers: ['@prisma/internals/src/utils/jestSnapshotSerializer'],
  setupFilesAfterEnv: ['./_utils/setupFilesAfterEnv.ts'],
  testTimeout: 10000,
  collectCoverage: process.env.CI ? true : false,

  /**
   * Limit concurrency to 1 worker for now for two reasons.
   *
   * First reason:
   *
   * Database isolation in setupTestSuiteDbURI() doesn't seem to work properly.
   * Tests are using the same database concurrently, which causes constraint
   * violation errors and "database does not exist" errors.
   * TODO: fix this.
   *
   * Second reason:
   *
   * Jest crashes when an assertion fails with an object that contains a BigInt
   * if more than one worker is used.
   * See https://github.com/facebook/jest/issues/11617
   */
  maxWorkers: 1,
}
