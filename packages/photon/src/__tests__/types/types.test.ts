import fs from 'fs'
import path from 'path'
import { CompilerOptions, createCompilerHost, createProgram, ModuleKind, ScriptTarget } from 'typescript'
import { generateInFolder } from '../../utils/generateInFolder'

jest.setTimeout(30000)

describe('valid types', () => {
  const subDirs = getSubDirs(__dirname)
  for (const dir of subDirs) {
    const testName = path.basename(dir)

    test(`can compile ${testName} example`, async () => {
      await generateInFolder({ projectDir: dir, useLocalRuntime: false, transpile: true })
      expect(() => compileFile(path.join(dir, 'index.ts'))).not.toThrow()
    })
  }
})

function getSubDirs(dir: string): string[] {
  const files = fs.readdirSync(dir)
  return files.map(file => path.join(dir, file)).filter(file => fs.lstatSync(file).isDirectory())
}

function compileFile(filePath: string): void {
  const options: CompilerOptions = {
    module: ModuleKind.CommonJS,
    target: ScriptTarget.ES2016,
    lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
    declaration: true,
    strict: true,
    suppressOutputPathCheck: false,
    esModuleInterop: true,
  }

  const compilerHost = createCompilerHost(options)
  compilerHost.writeFile = () => {
    //
  } // don't emit any files

  const program = createProgram([filePath], options, compilerHost)
  const result = program.emit()

  if (result.diagnostics.length > 0) {
    throw new Error('Compilation Error\n' + JSON.stringify(result.diagnostics))
  }
}
