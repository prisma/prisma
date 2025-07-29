import execa from 'execa'
import path from 'path'

type CompileFileOptions = {
  /**
   * Whether the TypeScript compiler should be isolated in a separate worker process.
   */
  isolateCompiler?: boolean
}

/**
 * Compiles a single file without emitting the output.
 * Throws on compilation errors.
 */
export async function compileFile(
  filePath: string,
  { isolateCompiler = true }: CompileFileOptions = {},
): Promise<void> {
  const workerPath = path.resolve(__dirname, 'compilerWorker.js')
  if (isolateCompiler) {
    await execa.node(workerPath, [filePath])
  } else {
    const compile = require(workerPath) as (filePath: string) => void
    compile(filePath)
  }
}
