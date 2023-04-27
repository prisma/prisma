'use strict'
const os = require('os')

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)

module.exports = () => {
  const configCommon = {
    testMatch: ['**/*.ts', '!(**/*.d.ts)', '!(**/_utils/**)', '!(**/_*.ts)', '!(**/.generated/**)'],
    transformIgnorePatterns: [],
    reporters: ['default'],
    globalSetup: './_utils/globalSetup.js',
    snapshotSerializers: ['@prisma/get-platform/src/test-utils/jestSnapshotSerializer'],
    setupFilesAfterEnv: ['./_utils/setupFilesAfterEnv.ts'],
    testTimeout: isMacOrWindowsCI ? 100_000 : 30_000,
    collectCoverage: process.env.CI ? true : false,
  }

  if (process.env['JEST_JUNIT_DISABLE'] !== 'true') {
    configCommon.reporters.push([
      'jest-junit',
      {
        addFileAttribute: 'true',
        ancestorSeparator: ' › ',
        classNameTemplate: (vars) => {
          return vars.classname
            .replace(/(\(.*)provider=\w+,? ?(.*\))/, '$1$2')
            .replace(/(\(.*)providerFlavor=\w+,? ?(.*\))/, '$1$2')
            .replace(' ()', '')
        },
        titleTemplate: '{title}',
      },
    ])
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
      '^.+\\.(m?j|t)s$': ['./esbuild-transformer', {}],
    },
  }
}
