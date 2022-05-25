import assert from 'assert'
import glob from 'globby'
import path from 'path'
import ts from 'typescript'

import { keys } from '../../../../../helpers/blaze/keys'
import { map } from '../../../../../helpers/blaze/map'
import { reduce } from '../../../../../helpers/blaze/reduce'

function getAllTestSuiteTypeChecks(fileNames: string[]) {
  const program = ts.createProgram(fileNames, {
    ...ts.convertCompilerOptionsFromJson(
      require('../../../../../tsconfig.build.regular.json').compilerOptions,
      path.dirname(expect.getState().testPath),
    ).options,
    skipLibCheck: false,
    noEmit: true,
  })

  return reduce(
    program.getSemanticDiagnostics(),
    (acc, diagnostic) => {
      if (diagnostic.file) {
        const filePath = diagnostic.file.fileName
        const diagnosticMessage = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
        const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!)
        const displayMessage = `${diagnosticMessage}\nat (${filePath}:${line + 1}:${character + 1})`
        return { ...acc, ...{ [filePath]: displayMessage } }
      }

      return acc
    },
    {} as { [key: string]: string },
  )
}

describe('typescript', () => {
  const suitePaths = glob.sync('./**/.generated/**/*.ts', {
    ignore: ['./**/.generated/**/*.d.ts', './**/.generated/**/_*.ts'],
  })
  const suiteChecks = getAllTestSuiteTypeChecks(suitePaths)
  const suiteTable = map(suitePaths, (path) => [getTestSuiteDisplayName(path), path])

  if (suiteTable.length === 0) return test('No test suites found', () => {})

  test.each(suiteTable)('%s', (_, suiteFilePath) => {
    for (const checkPath of keys(suiteChecks)) {
      if (checkPath.includes(path.dirname(suiteFilePath))) {
        assert.fail(suiteChecks[checkPath])
      }
    }
  })
})

function getTestSuiteDisplayName(filePath: string) {
  const testDir = path.join(path.dirname(filePath), '..')
  const testPath = path.relative(testDir, filePath)
  const suiteName = testPath.replace(/\.generated/g, '')

  return suiteName
}
