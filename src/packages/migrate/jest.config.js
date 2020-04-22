module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['dist/', 'fixtures/'],
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
}
