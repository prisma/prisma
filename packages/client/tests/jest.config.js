module.exports = {
  testMatch: ['<rootDir>/**/*.ts'],
  testPathIgnorePatterns: ['node_modules', '_utils/'],
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
    // '^.+\\.(t|j)sx?$': ['@swc/jest', {}],
  },
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
  snapshotSerializers: ['@prisma/sdk/src/utils/jestSnapshotSerializer'],
  setupFilesAfterEnv: ['./_utils/setup.ts'],
  testTimeout: 10000,
  collectCoverage: process.env.CI ? true : false,
}
