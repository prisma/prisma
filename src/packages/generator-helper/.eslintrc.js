const config = require('../.eslintrc.js')

config.overrides[0].rules = {
  '@typescript-eslint/no-use-before-define': 'off',
  '@typescript-eslint/no-non-null-assertion': 'off',
  '@typescript-eslint/no-misused-promises': [
    'error',
    {
      checksVoidReturn: false,
    },
  ],
  'no-async-promise-executor': 'off',
}

module.exports = config
