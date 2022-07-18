'use strict'
const forceTranspile = require('../../../../helpers/jest/forceTranspile')
const os = require('os')

module.exports = () => {
  const configCommon = {
    testMatch: ['**/*.ts', '!(**/*.d.ts)', '!(**/_utils/**)', '!(**/_*.ts)', '!(**/.generated/**)'],
    transformIgnorePatterns: [forceTranspile()],
    reporters: [
      'default',
      [
        'jest-junit',
        {
          addFileAttribute: 'true',
          ancestorSeparator: ' › ',
          classNameTemplate: '{classname}',
          titleTemplate: '{title}',
        },
      ],
    ],
    globalSetup: './_utils/globalSetup.js',
    snapshotSerializers: ['@prisma/internals/src/utils/jestSnapshotSerializer'],
    setupFilesAfterEnv: ['./_utils/setupFilesAfterEnv.ts'],
    testTimeout: 10_000,
    collectCoverage: process.env.CI ? true : false,
  }

  if (os.platform() === 'win32') {
    // swc sometimes produces incorrect source maps, in our case on windows only
    // https://github.com/swc-project/swc/issues/3180
    // this causes error stack traces to point to incorrect lines and all enriched errors
    // snapshots to fail. Until this is fixed, on windows we will be still using ts-jest
    return {
      ...configCommon,
      preset: 'ts-jest/presets/js-with-babel-legacy',
      globals: {
        'ts-jest': {
          isolatedModules: true,
        },
      },
    }
  }

  return {
    ...configCommon,
    transform: {
      '^.+\\.(m?j|t)s$': '@swc/jest',
    },
  }
}
