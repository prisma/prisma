import execa from 'execa'
import path from 'path'

export async function compileFile(filePath: string): Promise<void> {
  await execa.node(path.resolve(__dirname, 'compilerWorker.js'), [filePath])
}
