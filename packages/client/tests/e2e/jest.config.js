'use strict'

module.exports = () => {
  const configCommon = {
    rootDir: process.cwd(),
    testMatch: ['<rootDir>/tests/*.ts'],
    transformIgnorePatterns: [],
    testTimeout: 60_000,
  }

  return {
    ...configCommon,
    transform: {
      '^.+\\.(m?j|t)s$': '@swc/jest',
    },
  }
}
