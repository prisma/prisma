import path from 'path'
import * as ts from 'typescript'

const baseTsConfig = require('../../tsconfig.base.json').compilerOptions

const depTs = path.resolve(__dirname, '..', 'src', 'dep.ts')
const noDepTs = path.resolve(__dirname, '..', 'src', 'no-dep.ts')
const defaultTs = path.resolve(__dirname, '..', 'src', 'default.ts')

const allOptions = [
  { module: 'commonjs', moduleResolution: 'Node' },
  { module: 'ES2015', moduleResolution: 'Node' },
  { module: 'ES2020', moduleResolution: 'Node' },
  { module: 'ES2022', moduleResolution: 'Node' },
  { module: 'ESNext', moduleResolution: 'Node' },

  { module: 'Node16', moduleResolution: 'Node16' },
  { module: 'NodeNext', moduleResolution: 'Node16' },

  { module: 'Node16', moduleResolution: 'NodeNext' },
  { module: 'NodeNext', moduleResolution: 'NodeNext' },

  { module: 'ES2015', moduleResolution: 'Bundler' },
  { module: 'ES2020', moduleResolution: 'Bundler' },
  { module: 'ES2022', moduleResolution: 'Bundler' },
  { module: 'ESNext', moduleResolution: 'Bundler' },
]

test('custom import via dependency', () => {
  for (const options of allOptions) {
    typeCheck(depTs, options)
  }
})

test('custom direct import', () => {
  for (const options of allOptions) {
    typeCheck(noDepTs, options)
  }
})

test('default import', () => {
  for (const options of allOptions) {
    typeCheck(defaultTs, options)
  }
})

function typeCheck(fileName: string, options: any) {
  const fullOptions = ts.convertCompilerOptionsFromJson(
    { ...baseTsConfig, ...options },
    path.resolve(__dirname, '..', 'tsconfig.json'),
  )

  assertNoErrors(fullOptions.errors)

  const program = ts.createProgram([fileName], fullOptions.options)

  assertNoErrors(program.getConfigFileParsingDiagnostics())
  assertNoErrors(program.getOptionsDiagnostics())
  const sourceFile = program.getSourceFile(fileName)
  if (!sourceFile) {
    throw new Error(`Source file ${fileName} not found`)
  }
  assertNoErrors(program.getSemanticDiagnostics())
  assertNoErrors(program.getSyntacticDiagnostics())
}

function assertNoErrors(errors: readonly ts.Diagnostic[]) {
  if (errors.length > 0) {
    errors.map(console.error)

    throw new Error(`Test exited with ${errors.length} errors. See above for details.`)
  }
}
