import glob from 'globby'
import path from 'path'
import ts from 'typescript'

import { map } from '../../../../../helpers/blaze/map'
import { reduce } from '../../../../../helpers/blaze/reduce'
import { unique } from '../../../../../helpers/blaze/unique'

export function setupTestTypeCheck(fileNames: string[]) {
  const compilerOptions = ts.convertCompilerOptionsFromJson(
    require('../../../../../tsconfig.build.json').compilerOptions,
    '.',
  ).options

  const program = ts.createProgram(fileNames, compilerOptions)
  const allDiagnostics = program.getSemanticDiagnostics()

  return allDiagnostics
}

describe('typescript', () => {
  const files = glob.sync('../**/.generated/**/*.ts')
  const diagnostics = setupTestTypeCheck(files)
  const suiteFolders = map(files, (file) => path.dirname(file))

  reduce(
    diagnostics,
    (acc, diagnostic) => {
      if (diagnostic.file) {
        const fileName = diagnostic.file.fileName
        const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!)
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
        return { [fileName]: `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}` }
      } else {
        return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      }
    },
    {} as { [key: string]: string },
  )

  test.each(unique(suiteFolders))('%s', async (folder) => {})

  test('simple', () => {})
})
