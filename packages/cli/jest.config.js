/** @type {import('jest').Config} */
module.exports = {
  preset: '../../helpers/test/presets/withSnapshotSerializer.js',
  testPathIgnorePatterns: ['\\.vitest.ts$'],
}
