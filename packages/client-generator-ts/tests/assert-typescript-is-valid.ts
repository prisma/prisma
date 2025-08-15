import { match } from 'ts-pattern'
import ts from 'typescript'
import { expect } from 'vitest'

interface AssertTypeScriptIsValidInput {
  files: {
    [filename: string]: string
  }
  moduleFormat: 'cjs' | 'esm'
}

/**
 * Asserts that the provided TypeScript code is syntactically and semantically valid.
 */
export function assertTypeScriptIsValid({ files, moduleFormat }: AssertTypeScriptIsValidInput) {
  const configFromModuleFormat = match(moduleFormat)
    .with('cjs', () => ({
      module: ts.ModuleKind.Node16,
      moduleResolution: ts.ModuleResolutionKind.Node16,
      types: ['node'],
    }))
    .with('esm', () => ({
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      types: [],
    }))
    .exhaustive() satisfies Pick<ts.CompilerOptions, 'module' | 'moduleResolution' | 'types'>

  const compilerOptions = {
    ...configFromModuleFormat,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
    types: ['@types/node'],
    target: ts.ScriptTarget.ES2022,
    strict: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
    noEmit: true,
    allowJs: true,
    noImplicitAny: false,
    noResolve: false,
  } satisfies ts.CompilerOptions

  // Create virtual file map
  const virtualFiles = new Map<string, ts.SourceFile>()
  const rootFileNames: string[] = []

  // Needed to resolve type definitions, e.g., `@types/node`
  const cwd = process.cwd()

  for (const [filename, code] of Object.entries(files)) {
    const normalizedPath = filename.startsWith('./') ? filename.slice(2) : filename
    const absolutePath = `/${normalizedPath}`

    const sourceExtension = match(filename)
      .when(
        (name) => name.endsWith('.js') || name.endsWith('.mjs'),
        () => ts.ScriptKind.JS,
      )
      .when(
        (name) => name.endsWith('.ts'),
        () => ts.ScriptKind.TS,
      )
      .when(
        (name) => name.endsWith('.wasm'),
        () => ts.ScriptKind.External,
      )
      .otherwise(() => ts.ScriptKind.Unknown)

    if (sourceExtension !== ts.ScriptKind.External) {
      rootFileNames.push(absolutePath)
    }

    const sourceFile = ts.createSourceFile(absolutePath, code, compilerOptions.target, true, sourceExtension)

    virtualFiles.set(absolutePath, sourceFile)
    virtualFiles.set(filename, sourceFile)
  }

  const defaultHost = ts.createCompilerHost(compilerOptions)

  // Add WASM module declarations to handle .wasm imports
  const wasmModuleDeclarations = `
declare module '*.wasm' {
  const wasmModule: WebAssembly.Module
  export default wasmModule
}

declare module '*.wasm?module' {
  const wasmModule: WebAssembly.Module
  export default wasmModule
}
  `

  // Create the WASM declarations file
  const wasmDeclarationsFile = ts.createSourceFile(
    '/wasm-declarations.d.ts',
    wasmModuleDeclarations,
    compilerOptions.target,
    true,
    ts.ScriptKind.TS,
  )
  virtualFiles.set('/wasm-declarations.d.ts', wasmDeclarationsFile)
  rootFileNames.push('/wasm-declarations.d.ts')

  // Create a custom compiler host that serves files from memory
  const host: ts.CompilerHost = {
    getSourceFile: (fileName: string, languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions) => {
      // Don't try to parse .wasm files as TypeScript source files
      if (fileName.endsWith('.wasm') || fileName.endsWith('.wasm?module')) {
        return undefined
      }

      if (virtualFiles.has(fileName)) {
        // If the file is in our virtual files, return it
        return virtualFiles.get(fileName)
      }

      // For library files and other dependencies, delegate to the default host
      return defaultHost.getSourceFile(fileName, languageVersionOrOptions)
    },

    getDefaultLibFileName: (options: ts.CompilerOptions) => {
      const res = defaultHost.getDefaultLibFileName(options)
      return res
    },

    writeFile: () => {
      // No-op since we're not emitting files (noEmit: true)
    },

    getCurrentDirectory: () => cwd,

    getDirectories: (path: string) => {
      return defaultHost.getDirectories!(path)
    },

    fileExists: (fileName: string) => {
      // For .wasm files, pretend they exist but don't try to read them as source
      if (fileName.endsWith('.wasm') || fileName.endsWith('.wasm?module')) {
        return true
      }

      return virtualFiles.has(fileName) || defaultHost.fileExists(fileName)
    },

    readFile: (fileName: string) => {
      // Don't try to read .wasm files as text
      if (fileName.endsWith('.wasm') || fileName.endsWith('.wasm?module')) {
        return undefined
      }

      return virtualFiles.get(fileName)?.text ?? defaultHost.readFile(fileName)
    },

    getCanonicalFileName: (fileName: string) => {
      return fileName
    },

    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',

    resolveModuleNames: (moduleNames: string[], containingFile: string): Array<ts.ResolvedModule | undefined> => {
      return moduleNames.map((moduleName) => {
        // Don't try to resolve .wasm files as modules
        if (moduleName.endsWith('.wasm') || moduleName.endsWith('.wasm?module')) {
          return undefined
        }

        // If the module is already loaded in memory, return it directly
        if (virtualFiles.has(moduleName)) {
          return {
            resolvedFileName: moduleName,
            isExternalLibraryImport: false,
            extension: ts.Extension.Ts,
          }
        }

        // Use TypeScript's module resolution for everything else
        const result = ts.resolveModuleName(moduleName, containingFile, compilerOptions, defaultHost)

        return result.resolvedModule
      })
    },
  }

  // Create the program
  const program = ts.createProgram(rootFileNames, compilerOptions, host)

  // Get all diagnostics (type errors, syntax errors, etc.)
  const allDiagnostics = ts.getPreEmitDiagnostics(program)

  const diagnosticMessages = allDiagnostics.map((diagnostic) => {
    if (diagnostic.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!)
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      return `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
    } else {
      return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    }
  })

  expect(diagnosticMessages).toEqual([])
}
