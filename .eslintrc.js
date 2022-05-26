const globby = require('globby')
const fs = require('fs')
const path = require('path')

const ignoreFiles = globby.sync('packages/*/.eslintignore')

const ignorePatterns = flatten(
  flatten(
    ignoreFiles.map((f) => {
      const dir = path.dirname(f)
      return fs
        .readFileSync(f, 'utf-8')
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((l) => [l, `/${path.join(dir, l)}`])
    }),
  ),
)

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'jest', 'simple-import-sort', 'import'],
  env: {
    node: true,
    es6: true,
  },
  extends: ['eslint:recommended', 'plugin:eslint-comments/recommended', 'plugin:jest/recommended'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.eslint.json',
    // debugLevel: true,
  },
  ignorePatterns,
  overrides: [
    {
      files: ['*.ts'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'plugin:prettier/recommended',
        'plugin:jest/recommended',
      ],
      rules: {
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
    },
  ],
  settings: {
    jest: {
      version: 27,
    },
  },
}

function flatten(input) {
  const stack = [...input]
  const res = []
  while (stack.length) {
    // pop value from stack
    const next = stack.pop()
    if (Array.isArray(next)) {
      // push back array items, won't modify the original input
      stack.push(...next)
    } else {
      res.push(next)
    }
  }
  // reverse to restore input order
  return res.reverse()
}
