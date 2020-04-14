module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['build/', 'dist/'],
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
}