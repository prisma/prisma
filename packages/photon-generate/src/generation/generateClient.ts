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
import { Dictionary } from '../runtime/utils/common'
import makeDir from 'make-dir'

interface BuildClientOptions {
  datamodel: string
  browser: boolean
  prismaYmlPath?: string
  transpile?: boolean
  runtimePath?: string
}

export async function buildClient({
  datamodel,
  prismaYmlPath,
  transpile = false,
  runtimePath = './runtime',
  browser = false,
}: BuildClientOptions): Promise<Dictionary<string>> {
  const fileMap = {}
  const prismaConfig = prismaYmlPath ? await fs.readFile(prismaYmlPath, 'utf-8') : undefined
  const internalDatamodelJson =
    process.env.PRISMA_INTERNAL_DATAMODEL_JSON ||
    (await getInternalDatamodelJson(datamodel, path.join(__dirname, '../../runtime/schema-inferrer-bin')))

  if (process.env.PRISMA_INTERNAL_DATAMODEL_JSON) {
    console.log(`Taking cached datamodel json`)
  }

  const dmmf = getDMMF(datamodel)
  const client = new TSClient({
    document: dmmf,
    prismaYmlPath,
    prismaConfig,
    datamodel,
    datamodelJson: internalDatamodelJson,
    runtimePath,
    browser,
  })
  const generatedClient = String(client)
  const target = '@generated/photon/index.ts'

  if (!transpile) {
    fileMap[target] = generatedClient
    return normalizeFileMap(fileMap)
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
  compilerHost.writeFile = (fileName, data) => {
    if (fileName.includes('@generated/photon')) {
      fileMap[fileName] = data
    }
  }

  const program = createProgram([file.fileName], options, compilerHost)
  const result = program.emit()
  if (result.diagnostics.length > 0) {
    console.error(result.diagnostics)
  }
  return normalizeFileMap(fileMap)
}

function normalizeFileMap(fileMap: Dictionary<string>) {
  const sliceLength = '@generated/photon/'.length
  return Object.entries(fileMap).reduce((acc, [key, value]) => {
    acc[key.slice(sliceLength)] = value
    return acc
  }, {})
}

export async function generateClient(
  datamodel: string,
  prismaYmlPath: string,
  outputDir: string,
  transpile: boolean = false,
  runtimePath: string = './runtime',
  browser: boolean = false,
  printDMMF: boolean = false, // needed for debugging
) {
  if (!(await fs.pathExists(prismaYmlPath))) {
    throw new Error(`Provided prisma.yml path ${prismaYmlPath} does not exist`)
  }
  const files = await buildClient({ datamodel, prismaYmlPath, transpile, runtimePath, browser })
  await makeDir(outputDir)
  await Promise.all(Object.entries(files).map(([fileName, file]) => fs.writeFile(path.join(outputDir, fileName), file)))
  await fs.copy(path.join(__dirname, '../../runtime'), path.join(outputDir, '/runtime'))
  await fs.writeFile(path.join(outputDir, '/runtime/index.d.ts'), indexDTS)
}

const indexDTS = `export { DMMF } from './dmmf-types'
export { DMMFClass } from './dmmf'
export { deepGet, deepSet } from './utils/deep-set'
export { makeDocument, transformDocument } from './query'
export { Engine } from './dist/Engine'

export declare var debugLib: debug.Debug & { debug: debug.Debug; default: debug.Debug };

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
