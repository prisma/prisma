import {
  CompilerOptions,
  createCompilerHost,
  createProgram,
  ModuleKind,
  ScriptTarget,
} from 'typescript'
import * as ts from 'typescript'


export function compileFile(filePath: string): void {
  const options: CompilerOptions = {
    module: ModuleKind.CommonJS,
    target: ScriptTarget.ES2018,
    lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
    declaration: true,
    strict: true,
    esModuleInterop: true,
    noEmitOnError: true,
    skipLibCheck: false,
  }

  const compilerHost = createCompilerHost(options)
  compilerHost.writeFile = (fileName, file) => { }

  const program = createProgram([filePath], options, compilerHost)
  const result = program.emit()

  if (result.diagnostics.length > 0) {
    const formatted = ts.formatDiagnostics(result.diagnostics, compilerHost)
    throw new Error('Compilation Error\n' + formatted)
  }
}
