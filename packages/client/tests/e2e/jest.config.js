'use strict'

module.exports = () => {
  const configCommon = {
    testMatch: ['**/tests/*.ts'],
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
