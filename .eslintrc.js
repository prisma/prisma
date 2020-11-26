module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'jest'],
  env: {
    node: true,
    es6: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:eslint-comments/recommended',
    'plugin:jest/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: ['./src/packages/*/tsconfig.json' /*, 'tsconfig.json'*/],
    // debugLevel: true,
  },
  overrides: [
    // {
    //   files: ['*.js'],
    //   rules: {},
    // },
    {
      files: ['*.ts'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'prettier/@typescript-eslint',
        'plugin:jest/recommended',
      ],
      rules: {
        '@typescript-eslint/no-use-before-define': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'no-useless-escape': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        // added at 2020/11/26
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        'eslint-comments/no-unlimited-disable': 'off',
        'eslint-comments/disable-enable-pair': 'off',
        '@typescript-eslint/no-misused-promises': 'off',
        'jest/expect-expect': 'off',
        'no-empty': 'off',
        // low hanging fruits:
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/restrict-plus-operands': 'off',
        '@typescript-eslint/restrict-template-expressions': 'off',
        'jest/no-conditional-expect': 'off',
        'jest/no-try-expect': 'off',
        'jest/no-export': 'off',
      },
    },
  ],
  settings: {
    jest: {
      version: 26,
    },
  },
}
