import fs from 'fs-extra'
import path from 'path'
import { TSClient } from './TSClient'
import { getDMMF } from '../utils/getDMMF'
import { getInternalDatamodelJson } from '@prisma/engine-core'
import {
  createProgram,
  ScriptTarget,
  ModuleKind,
  createCompilerHost,
  createSourceFile,
  CompilerOptions,
} from 'typescript'

export async function generateClient(
  datamodel: string,
  prismaYmlPath: string,
  outputDir: string,
  transpile: boolean = false,
  runtimePath: string = './runtime',
  printDMMF: boolean = false, // needed for debugging
) {
  if (!(await fs.pathExists(prismaYmlPath))) {
    throw new Error(`Provided prisma.yml path ${prismaYmlPath} does not exist`)
  }

  const prismaConfig = await fs.readFile(prismaYmlPath, 'utf-8')
  const internalDatamodelJson =
    process.env.PRISMA_INTERNAL_DATAMODEL_JSON ||
    (await getInternalDatamodelJson(datamodel, path.join(__dirname, '../../runtime/schema-inferrer-bin')))

  if (process.env.PRISMA_INTERNAL_DATAMODEL_JSON) {
    console.log(`Taking cached datamodel json`)
  }

  await fs.mkdirp(outputDir)

  const dmmf = getDMMF(datamodel)
  if (printDMMF) {
    await fs.writeFile(path.join(outputDir, 'dmmf2.json'), JSON.stringify(dmmf, null, 2))
  }
  const client = new TSClient(dmmf, prismaYmlPath, prismaConfig, datamodel, internalDatamodelJson, runtimePath)
  const generatedClient = String(client)
  await fs.copy(path.join(__dirname, '../../runtime'), path.join(outputDir, '/runtime'))
  const target = path.join(outputDir, 'index.ts')

  if (!transpile) {
    await fs.writeFile(target, generatedClient)
    return
  }

  /**
   * If transpile === true, replace index.ts with index.js and index.d.ts
   * WARNING: This takes a long time
   * TODO: Implement transpilation as a separate code generator
   */

  const options: CompilerOptions = {
    module: ModuleKind.CommonJS,
    target: ScriptTarget.ES2016,
    lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
    declaration: true,
    strict: true,
    suppressOutputPathCheck: false,
  }
  const file: any = { fileName: target, content: generatedClient }

  const compilerHost = createCompilerHost(options)
  const originalGetSourceFile = compilerHost.getSourceFile
  compilerHost.getSourceFile = fileName => {
    const newFileName = redirectToLib(fileName)
    if (fileName === file.fileName) {
      file.sourceFile = file.sourceFile || createSourceFile(fileName, file.content, ScriptTarget.ES2015, true)
      return file.sourceFile
    }
    return (originalGetSourceFile as any).call(compilerHost, newFileName)
  }

  const program = createProgram([file.fileName], options, compilerHost)
  const result = program.emit()
  if (result.diagnostics.length > 0) {
    console.error(result.diagnostics)
  }
  await fs.writeFile(path.join(outputDir, '/runtime/index.d.ts'), indexDTS)
}

const indexDTS = `export { DMMF } from './dmmf-types'
export { DMMFClass } from './dmmf'
export { deepGet, deepSet } from './utils/deep-set'
export { makeDocument } from './query'
export { Engine } from './dist/Engine'

declare var debugLib: debug.Debug & { debug: debug.Debug; default: debug.Debug };
export debugLib

declare namespace debug {
    interface Debug {
        (namespace: string): Debugger;
        coerce: (val: any) => any;
        disable: () => string;
        enable: (namespaces: string) => void;
        enabled: (namespaces: string) => boolean;
        log: (...args: any[]) => any;

        names: RegExp[];
        skips: RegExp[];

        formatters: Formatters;
    }

    type IDebug = Debug;

    interface Formatters {
        [formatter: string]: (v: any) => string;
    }

    type IDebugger = Debugger;

    interface Debugger {
        (formatter: any, ...args: any[]): void;

        enabled: boolean;
        log: (...args: any[]) => any;
        namespace: string;
        destroy: () => boolean;
        extend: (namespace: string, delimiter?: string) => Debugger;
    }
}
`

// This is needed because ncc rewrite some paths
function redirectToLib(fileName: string) {
  const file = path.basename(fileName)
  if (/^lib\.(.*?)\.d\.ts$/.test(file)) {
    if (!fs.pathExistsSync(fileName)) {
      const dir = path.dirname(fileName)
      return path.join(dir, 'lib', file)
    }
  }

  return fileName
}
