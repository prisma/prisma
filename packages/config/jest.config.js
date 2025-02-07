module.exports = {
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^test-utils/(.*)$': '<rootDir>/src/__tests__/_utils/$1',
  },
  preset: '../../helpers/test/presets/default.js',
}
