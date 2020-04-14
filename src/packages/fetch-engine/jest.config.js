module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['build/', 'dist/', 'generator/', 'runtime/', 'scripts/', 'sandbox/'],
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
}