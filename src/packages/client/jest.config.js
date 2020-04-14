module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: [
    'build/',
    'dist/',
    'generator/',
    'runtime/',
    '@prisma',
    'index.ts',
    'index.js',
  ],
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
}