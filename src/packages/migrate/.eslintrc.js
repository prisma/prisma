const config = require('../.eslintrc.js')

config.overrides[0].rules = {
  '@typescript-eslint/no-unsafe-assignment': 'warn',
  '@typescript-eslint/no-unsafe-member-access': 'warn',
  '@typescript-eslint/no-unsafe-call': 'warn',
  '@typescript-eslint/restrict-template-expressions': 'warn',
}

module.exports = config
