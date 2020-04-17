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
    project: 'tsconfig.json',
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
        // '@typescript-eslint/no-unused-vars': 'off',
        // '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-use-before-define': 'off',
        // '@typescript-eslint/no-non-null-assertion': 'off',
        // '@typescript-eslint/no-unnecessary-type-assertion': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        // '@typescript-eslint/no-misused-promises': [
        //   'error',
        //   {
        //     checksVoidReturn: false,
        //   },
        // ],
        // 'no-async-promise-executor': 'off',
        // 'no-useless-escape': 'off',
        // 'no-empty': 'off',
        // 'require-await': 'off',
        // 'jest/no-try-expect': 'off',
      },
    },
  ],
}