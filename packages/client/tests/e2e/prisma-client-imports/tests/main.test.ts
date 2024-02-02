import path from 'path'
import * as ts from 'typescript'

const baseTsConfig = require('../../tsconfig.base.json').compilerOptions

const depTs = path.resolve(__dirname, '..', 'src', 'dep.ts')
const noDepTs = path.resolve(__dirname, '..', 'src', 'no-dep.ts')
const defaultTs = path.resolve(__dirname, '..', 'src', 'default.ts')
const prismaClientName = ts.escapeLeadingUnderscores('PrismaClient')

const deprecatedOptions = [
  { module: 'commonjs', moduleResolution: 'Node' },
  { module: 'ES2015', moduleResolution: 'Node' },
  { module: 'ES2020', moduleResolution: 'Node' },
  { module: 'ES2022', moduleResolution: 'Node' },
  { module: 'ESNext', moduleResolution: 'Node' },
]

const nonDeprecatedOptions = [
  { module: 'Node16', moduleResolution: 'Node16' },
  { module: 'NodeNext', moduleResolution: 'Node16' },

  { module: 'Node16', moduleResolution: 'NodeNext' },
  { module: 'NodeNext', moduleResolution: 'NodeNext' },

  { module: 'ES2015', moduleResolution: 'Bundler' },
  { module: 'ES2020', moduleResolution: 'Bundler' },
  { module: 'ES2022', moduleResolution: 'Bundler' },
  { module: 'ESNext', moduleResolution: 'Bundler' },
]

const allOptions = deprecatedOptions.concat(nonDeprecatedOptions)

describe('custom import via dependency', () => {
  for (const options of deprecatedOptions) {
    test(`${JSON.stringify(options)}: PrismaClient is deprecated`, () => {
      expect(isPrismaClientDeprecated(depTs, options)).toBe(true)
    })
  }

  for (const options of nonDeprecatedOptions) {
    test(`${JSON.stringify(options)}: PrismaClient is not deprecated`, () => {
      expect(isPrismaClientDeprecated(depTs, options)).toBe(false)
    })
  }
})

describe('custom direct import', () => {
  // for direct import, client should always be deprecated
  for (const options of allOptions) {
    test(`${JSON.stringify(options)}: PrismaClient is deprecated`, () => {
      expect(isPrismaClientDeprecated(noDepTs, options)).toBe(true)
    })
  }
})

describe('default import', () => {
  // for default import, client should never be deprecated
  for (const options of allOptions) {
    test(`${JSON.stringify(options)}: PrismaClient is not deprecated`, () => {
      expect(isPrismaClientDeprecated(defaultTs, options)).toBe(false)
    })
  }
})

function isPrismaClientDeprecated(fileName: string, options: any) {
  const fullOptions = ts.convertCompilerOptionsFromJson(
    { ...baseTsConfig, ...options },
    path.resolve(__dirname, '..', 'tsconfig.json'),
  )

  assertNoErrors(fullOptions.errors)

  const program = ts.createProgram([fileName], fullOptions.options)

  assertNoErrors(program.getConfigFileParsingDiagnostics())
  assertNoErrors(program.getOptionsDiagnostics())
  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(fileName)
  if (!sourceFile) {
    throw new Error(`Source file ${fileName} not found`)
  }
  assertNoErrors(program.getSemanticDiagnostics())
  assertNoErrors(program.getSyntacticDiagnostics())
  const prismaImport = findPrismaImport(sourceFile)
  if (!prismaImport) {
    throw new Error(`No PrismaClient import found in ${fileName}}`)
  }
  const type = checker.getTypeAtLocation(prismaImport)
  const deprecatedTag = type.symbol.getJsDocTags().find((tag) => tag.name === 'deprecated')
  return Boolean(deprecatedTag)
}

function assertNoErrors(errors: readonly ts.Diagnostic[]) {
  if (errors.length > 0) {
    errors.map(console.error)

    throw new Error(`Test exited with ${errors.length} errors. See above for details.`)
  }
}

function findPrismaImport(sourceFile: ts.SourceFile) {
  let result: ts.ImportSpecifier | undefined = undefined
  const visit = (node: ts.Node) => {
    if (ts.isImportSpecifier(node) && node.name.escapedText === prismaClientName) {
      result = node
    } else {
      ts.forEachChild(node, visit)
    }
  }

  ts.forEachChild(sourceFile, visit)
  return result
}
