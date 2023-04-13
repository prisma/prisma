'use strict'
const os = require('os')
const path = require('path')

const packagesDir = path.resolve(__dirname, '..', '..', '..')
const runtimeDir = path.dirname(require.resolve('../../runtime'))

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)

module.exports = () => {
  const configCommon = {
    testMatch: ['**/*.ts', '!(**/*.d.ts)', '!(**/_utils/**)', '!(**/_*.ts)', '!(**/.generated/**)'],
    // By default, jest passes every file it loads thorough a transform and caches result both on disk and in memory
    // That includes all generated clients as well. So, unless we ignore them, they'd be kept in memory until test process
    // is finished, even though they are needed for 1 test only
    transformIgnorePatterns: [
      '^((?!.*?\\.generated/@prisma/client/).)+$',
      escapeRegex(runtimeDir),
      `${escapeRegex(packagesDir)}[\\/][^\\/]+[\\/]dist[\\/]`,
    ],
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
      '^.+\\.(m?j|t)s$': '@swc/jest',
    },
  }
}

/**
 * https://stackoverflow.com/a/6969486
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
