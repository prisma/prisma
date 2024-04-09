module.exports = {
  preset: '../../helpers/test/presets/withSnapshotSerializer.js',
  coveragePathIgnorePatterns: [
    'bin.ts',
    'setupMysql.ts',
    'setupPostgres.ts',
    'test-SchemaEngineCommands.ts',
    'test-handlePanic.ts',
  ],
  // to get rid of "jest-haste-map: Haste module naming collision: package name"
  modulePathIgnorePatterns: ['<rootDir>/src/__tests__/fixtures/'],
}
