module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['dist/', 'fixtures/', '__helpers__'],
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
}
