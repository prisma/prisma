module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 999999,
  modulePaths: ['<rootDir>/happy/**/*.ts', '<rootDir>/errors/**/*.ts'],
  reporters: ['default'],
  snapshotSerializers: ['@prisma/sdk/src/utils/jestSnapshotSerializer'],
  globals: {
    'ts-jest': {
      tsconfig: '../../../../../tsconfig.json',
    },
  },
}
