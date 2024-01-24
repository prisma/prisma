import path from 'path'
import * as ts from 'typescript'

const baseTsConfig = require('../../tsconfig.base.json').compilerOptions

const depTs = path.resolve(__dirname, '..', 'src', 'dep.ts')
const noDepTs = path.resolve(__dirname, '..', 'src', 'no-dep.ts')
const prismaClientName = ts.escapeLeadingUnderscores('PrismaClient')

const deprecatedOptions = [
  { module: 'commonjs', moduleResolution: 'Node' },
  { module: 'ES2015', moduleResolution: 'Node' },
  { module: 'ES2020', moduleResolution: 'Node' },
  { module: 'ES2022', moduleResolution: 'Node' },
  { module: 'ESNext', moduleResolution: 'Node' },
  { module: 'Node16', moduleResolution: 'Node' },
  { module: 'NodeNext', moduleResolution: 'Node' },
]

const nonDeprecatedOptions = [
  { module: 'ES2015', moduleResolution: 'Node16' },
  { module: 'ES2020', moduleResolution: 'Node16' },
  { module: 'ES2022', moduleResolution: 'Node16' },
  { module: 'ESNext', moduleResolution: 'Node16' },
  { module: 'Node16', moduleResolution: 'Node16' },
  { module: 'NodeNext', moduleResolution: 'Node16' },

  { module: 'ES2015', moduleResolution: 'NodeNext' },
  { module: 'ES2020', moduleResolution: 'NodeNext' },
  { module: 'ES2022', moduleResolution: 'NodeNext' },
  { module: 'ESNext', moduleResolution: 'NodeNext' },
  { module: 'Node16', moduleResolution: 'NodeNext' },
  { module: 'NodeNext', moduleResolution: 'NodeNext' },

  { module: 'ES2015', moduleResolution: 'Bundler' },
  { module: 'ES2020', moduleResolution: 'Bundler' },
  { module: 'ES2022', moduleResolution: 'Bundler' },
  { module: 'ESNext', moduleResolution: 'Bundler' },
  { module: 'Node16', moduleResolution: 'Bundler' },
  { module: 'NodeNext', moduleResolution: 'Bundler' },
]

describe('import via dependency', () => {
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

describe('direct import', () => {
  // for direct import, client should always be deprecated
  for (const options of deprecatedOptions.concat(nonDeprecatedOptions)) {
    test(`${JSON.stringify(options)}: PrismaClient is deprecated`, () => {
      expect(isPrismaClientDeprecated(noDepTs, options)).toBe(true)
    })
  }
})

function isPrismaClientDeprecated(fileName: string, options: any) {
  const fullOptions = ts.convertCompilerOptionsFromJson(
    { ...baseTsConfig, ...options },
    path.resolve(__dirname, '..', 'tsconfig.json'),
  )

  if (fullOptions.errors.length > 0) {
    throw new Error(`Config file errors: ${fullOptions.errors.map((err) => err.messageText).join('\n')}`)
  }

  const program = ts.createProgram([fileName], fullOptions.options)
  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(fileName)
  if (!sourceFile) {
    throw new Error(`Source file ${fileName} not found`)
  }
  const diagnostic = program.getSemanticDiagnostics(sourceFile)
  if (diagnostic.length > 0) {
    const error = diagnostic.map((error) => error.messageText).join('\n\n')
    throw new Error(`TS Error: ${error}`)
  }
  const prismaImport = findPrismaImport(sourceFile)
  if (!prismaImport) {
    throw new Error(`No PrismaClient import found in ${fileName}}`)
  }
  const type = checker.getTypeAtLocation(prismaImport)
  const deprecatedTag = type.symbol.getJsDocTags().find((tag) => tag.name === 'deprecated')
  return Boolean(deprecatedTag)
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
