import assert from 'assert'
import glob from 'globby'
import path from 'path'
import ts from 'typescript'

import { map } from '../../../../../helpers/blaze/map'
import { reduce } from '../../../../../helpers/blaze/reduce'

function getAllTestSuiteTypeChecks(fileNames: string[]) {
  const program = ts.createProgram(fileNames, {
    ...ts.convertCompilerOptionsFromJson(
      require('../../../../../tsconfig.build.json').compilerOptions,
      path.dirname(expect.getState().testPath),
    ).options,
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
  const testSuitePaths = glob.sync('./**/.generated/**/*[!*.d.].ts')
  const testSuiteChecks = getAllTestSuiteTypeChecks(testSuitePaths)
  const testSuiteTable = map(testSuitePaths, (path) => [getTestSuiteDisplayName(path), path])

  test.each(testSuiteTable)('%s', (_, testSuiteFilePath) => {
    assert(!testSuiteChecks[testSuiteFilePath], testSuiteChecks[testSuiteFilePath])
  })
})

function getTestSuiteDisplayName(filePath: string) {
  const testDir = path.join(path.dirname(filePath), '..')
  const testPath = path.relative(testDir, filePath)
  const suiteName = testPath.replace(/\.generated/g, '')

  return suiteName
}
