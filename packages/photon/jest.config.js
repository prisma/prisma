module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['build/', 'dist/', 'generator/', 'runtime/', '@generated', 'index.ts'],
}
