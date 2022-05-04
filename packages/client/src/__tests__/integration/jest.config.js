module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 999999,
  modulePaths: ['<rootDir>/happy/**/*.ts', '<rootDir>/errors/**/*.ts'],
  modulePathIgnorePatterns: [
    '<rootDir>/happy/composites-mongo/__helpers__',
    '<rootDir>/happy/logging/__helpers__',
    '<rootDir>/happy/signals/__helpers__',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/happy/exhaustive-schema/generated-dmmf.ts',
    '<rootDir>/happy/exhaustive-schema-mongo/generated-dmmf.ts',
  ],
  reporters: ['default'],
  snapshotSerializers: ['@prisma/sdk/src/utils/jestSnapshotSerializer'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
}
