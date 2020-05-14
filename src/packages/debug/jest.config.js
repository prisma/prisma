module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['build/', 'dist/', 'generator/', 'runtime/'],
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
}
