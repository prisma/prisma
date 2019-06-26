import copy from '@apexearth/copy'
import { LiftEngine } from '@prisma/lift'
import fs from 'fs'
import makeDir from 'make-dir'
import path from 'path'
import {
  CompilerOptions,
  createCompilerHost,
  createProgram,
  createSourceFile,
  ModuleKind,
  ScriptTarget,
} from 'typescript'
import { promisify } from 'util'
import { Dictionary } from '../runtime/utils/common'
import { getDMMF } from '../utils/getDMMF'
import { TSClient } from './TSClient'

const remove = promisify(fs.unlink)
const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)

interface BuildClientOptions {
  datamodel: string
  browser: boolean
  cwd?: string
  transpile?: boolean
  runtimePath?: string
  binaryPath?: string
}

export async function buildClient({
  datamodel,
  cwd,
  transpile = false,
  runtimePath = './runtime',
  browser = false,
  binaryPath,
}: BuildClientOptions): Promise<Dictionary<string>> {
  const fileMap = {}

  const dmmf = await getDMMF({ datamodel, cwd, prismaPath: binaryPath })
  const liftEngine = new LiftEngine({
    projectDir: cwd,
  })
  const config = await liftEngine.getConfig({ datamodel })
  const datamodelWithoutDatasources = await liftEngine.convertDmmfToDml({
    config: {
      datasources: [],
      generators: [],
    },
    dmmf: JSON.stringify(dmmf.datamodel),
  })

  const client = new TSClient({
    document: dmmf,
    cwd,
    datamodel: datamodelWithoutDatasources.datamodel,
    runtimePath,
    browser,
    datasources: config.datasources,
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

  const normalizedFileMap = normalizeFileMap(fileMap)
  if (normalizedFileMap['index.js']) {
    // add module.exports = Photon for javascript usage
    normalizedFileMap['index.js'] = addEsInteropRequire(normalizedFileMap['index.js'])
  }
  return normalizedFileMap
}

function normalizeFileMap(fileMap: Dictionary<string>) {
  const sliceLength = '@generated/photon/'.length
  return Object.entries(fileMap).reduce((acc, [key, value]) => {
    acc[key.slice(sliceLength)] = value
    return acc
  }, {})
}

export interface GenerateClientOptions {
  datamodel: string
  cwd?: string
  outputDir: string
  transpile?: boolean
  runtimePath?: string
  browser?: boolean
  binaryPath?: string
}

export async function generateClient({
  datamodel,
  cwd,
  outputDir,
  transpile,
  runtimePath,
  browser,
  binaryPath,
}: GenerateClientOptions) {
  if (cwd && cwd.endsWith('.yml')) {
    cwd = path.dirname(cwd)
  }
  runtimePath = runtimePath || './runtime'
  const files = await buildClient({ datamodel, cwd, transpile, runtimePath, browser, binaryPath })
  await makeDir(outputDir)
  await Promise.all(
    Object.entries(files).map(async ([fileName, file]) => {
      const filePath = path.join(outputDir, fileName)
      // The deletion of the file is necessary, so VSCode
      // picks up the changes.
      if (await exists(filePath)) {
        await remove(filePath)
      }
      await writeFile(filePath, file)
    }),
  )
  const inputDir = path.join(__dirname, '../../runtime')
  await copy({
    from: inputDir,
    to: path.join(outputDir, '/runtime'),
    recursive: true,
    parallelJobs: 20,
  })
  await writeFile(path.join(outputDir, '/runtime/index.d.ts'), backup)
}

// TODO: fix type
// export { Engine } from './dist/Engine'

const backup = `export { DMMF } from './dmmf-types'
// export { DMMFClass } from './dmmf'
// export { deepGet, deepSet } from './utils/deep-set'
// export { makeDocument, transformDocument } from './query'

export declare var Engine: any
export declare type Engine = any

// export declare var DMMF: any
// export declare type DMMF = any

export declare var DMMFClass: any
export declare type DMMFClass = any

export declare var deepGet: any
export declare type deepGet = any

export declare var deepSet: any
export declare type deepSet = any

export declare var makeDocument: any
export declare type makeDocument = any

export declare var transformDocument: any
export declare type transformDocument = any

export declare var debug: any
export declare type debug = any

export declare var debugLib: any
export declare type debugLib = any

export declare var InternalDatasource: any
export declare type InternalDatasource = any

export declare var Datasource: any
export declare type Datasource = any

export declare var printDatasources: any
export declare type printDatasources = any
`

// const indexDTS = `export { DMMF } from './dmmf-types'
// export { DMMFClass } from './dmmf'
// export { deepGet, deepSet } from './utils/deep-set'
// export { InternalDatasource, Datasource, printDatasources } from './utils/printDatasources';
// export { makeDocument, transformDocument } from './query'

// export declare var Engine: any
// export declare type Engine = any

// export declare var debugLib: debug.Debug & { debug: debug.Debug; default: debug.Debug };

// declare namespace debug {
//   interface Debug {
//     (namespace: string): Debugger;
//     coerce: (val: any) => any;
//     disable: () => string;
//     enable: (namespaces: string) => void;
//     enabled: (namespaces: string) => boolean;
//     log: (...args: any[]) => any;

//     names: RegExp[];
//     skips: RegExp[];

//     formatters: Formatters;
//   }

//   type IDebug = Debug;

//   interface Formatters {
//     [formatter: string]: (v: any) => string;
//   }

//   type IDebugger = Debugger;

//   interface Debugger {
//     (formatter: any, ...args: any[]): void;

//     enabled: boolean;
//     log: (...args: any[]) => any;
//     namespace: string;
//     destroy: () => boolean;
//     extend: (namespace: string, delimiter?: string) => Debugger;
//   }
// }
// `

// This is needed because ncc rewrite some paths
function redirectToLib(fileName: string) {
  const file = path.basename(fileName)
  if (/^lib\.(.*?)\.d\.ts$/.test(file)) {
    if (!exists(fileName)) {
      const dir = path.dirname(fileName)
      return path.join(dir, 'lib', file)
    }
  }

  return fileName
}

function addEsInteropRequire(code: string) {
  const interopCode = `module.exports = Photon; // needed to support const Photon = require('...') in js
module.exports.default = Photon
Object.defineProperty(module.exports, "__esModule", { value: true });`
  const lines = code.split('\n')
  const exportLineIndex = lines.findIndex(line => line.startsWith('exports.default'))

  lines.splice(exportLineIndex, 0, interopCode)
  // we now need to reexpose all exports as `exports` is dangling now
  // yes we go through a lot of trouble for our users
  lines.push(`module.exports.dmmf = exports.dmmf`)
  return lines.join('\n')
}
