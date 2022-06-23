module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'jest', 'simple-import-sort', 'import'],
  env: {
    node: true,
    es6: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: ['./tsconfig.json'],
  },
  overrides: [
    {
      files: ['*.ts'],
    },
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:prettier/recommended',
    'plugin:jest/recommended',
  ],
  rules: {
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': ['error', { hoist: 'all' }],
    'prettier/prettier': 'warn',
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
    'no-restricted-properties': [
      'error',
      {
        property: 'substr',
        message: 'Deprecated: Use .slice() instead of .substr().',
      },
    ],
    'jest/valid-title': 'off',
    '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    // low hanging fruits:
    // to unblock eslint dep update in https://github.com/prisma/prisma/pull/9692
    '@typescript-eslint/no-unsafe-argument': 'warn',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/restrict-plus-operands': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',
    'jest/no-conditional-expect': 'off',
    'jest/no-export': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    // Allow the `testIf`/`describeIf` pattern.
    // TODO: it's not exactly correct to have `describeIf` in `additionalTestBlockFunctions`,
    // but it's better than disabling the rule completely for files that need `describeIf`.
    // Ideally, a new option like `additionalDescribeBlockFunctions` should be implemented in the rule.
    'jest/no-standalone-expect': [
      'error',
      {
        additionalTestBlockFunctions: ['testIf', 'describeIf'],
      },
    ],
    // https://github.com/lydell/eslint-plugin-simple-import-sort
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
    'import/first': 'error',
    'import/newline-after-import': 'error',
    'import/no-duplicates': 'error',
  },
  settings: {
    jest: {
      version: 27,
    },
  },
}
