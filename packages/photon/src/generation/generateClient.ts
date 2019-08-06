import copy from '@apexearth/copy'
import { GeneratorConfig } from '@prisma/cli'
import { fixPlatforms, printGeneratorConfig } from '@prisma/engine-core'
import { download } from '@prisma/fetch-engine'
import { getPlatform, Platform } from '@prisma/get-platform'
import { LiftEngine } from '@prisma/lift'
import chalk from 'chalk'
import Debug from 'debug'
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
import { resolveDatasources } from '../utils/resolveDatasources'
import { extractSqliteSources } from './extractSqliteSources'
import { TSClient } from './TSClient'

const debug = Debug('generateClient')

const remove = promisify(fs.unlink)
const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)
const copyFile = promisify(fs.copyFile)

export interface GenerateClientOptions {
  datamodel: string
  datamodelPath?: string
  browser?: boolean
  cwd?: string
  transpile?: boolean
  runtimePath?: string
  binaryPath?: string
  outputDir: string
  platforms?: string[]
  pinnedPlatform?: string
  version?: string
  generator?: GeneratorConfig
}

export async function buildClient({
  datamodel,
  datamodelPath,
  cwd,
  transpile = false,
  runtimePath = './runtime',
  browser = false,
  binaryPath,
  outputDir,
  generator,
  platforms,
}: GenerateClientOptions): Promise<Dictionary<string>> {
  // TODO: handle pinnedPlatform

  const fileMap = {}

  const dmmf = await getDMMF({ datamodel, datamodelPath, cwd, prismaPath: binaryPath })
  const liftEngine = new LiftEngine({
    projectDir: cwd || process.cwd(),
  })
  const config = await liftEngine.getConfig({ datamodel })

  const client = new TSClient({
    document: dmmf,
    datamodel,
    runtimePath,
    browser,
    datasources: resolveDatasources(config.datasources, cwd || process.cwd(), outputDir),
    sqliteDatasourceOverrides: extractSqliteSources(datamodel, cwd || process.cwd(), outputDir),
    generator,
    platforms,
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
    esModuleInterop: true,
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
    console.error(chalk.redBright('Errors during Photon generation:'))
    console.error(result.diagnostics.map(d => d.messageText).join('\n'))
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

export async function generateClient({
  datamodel,
  datamodelPath,
  cwd,
  outputDir,
  transpile,
  runtimePath,
  browser,
  binaryPath,
  platforms,
  pinnedPlatform,
  version,
  generator,
}: GenerateClientOptions) {
  const thePlatforms = platforms && platforms.length > 0 ? platforms : ['native']
  const platform = await getPlatform()
  const resolvedPlatforms = await Promise.all(thePlatforms.map(async p => (p === 'native' ? platform : p)))

  if (!resolvedPlatforms.includes(platform)) {
    if (generator) {
      console.log(`${chalk.yellow('Warning:')} Your current platform \`${chalk.bold(
        platform,
      )}\` is not included in your generator's \`platforms\` configuration.
To fix it, use this generator config in your ${chalk.bold('schema.prisma')}:
${chalk.greenBright(
  printGeneratorConfig({ ...generator, platforms: fixPlatforms(generator.platforms as Platform[], platform) }),
)}
${chalk.gray(
  `Note, that by providing \`native\`, Photon automatically resolves \`${platform}\`.
Read more about deploying Photon: ${chalk.underline(
    'https://github.com/prisma/prisma2/blob/master/docs/core/generators/photonjs.md',
  )}`,
)}\n`)
    } else {
      console.log(
        `${chalk.yellow('Warning')} The platforms ${JSON.stringify(
          platforms,
        )} don't include your local platform ${platform}, which you can also point to with \`native\`.
In case you want to fix this, you can provide ${chalk.greenBright(
          `platforms: ${JSON.stringify(['native', ...(platforms || [])])}`,
        )} in the schema.prisma file.`,
      )
    }
  }

  const theVersion = version || 'latest'
  if (cwd && cwd.endsWith('.yml')) {
    cwd = path.dirname(cwd)
  }
  runtimePath = runtimePath || './runtime'
  const files = await buildClient({
    datamodel,
    cwd,
    transpile,
    runtimePath,
    browser,
    binaryPath,
    outputDir,
    platforms: resolvedPlatforms,
    pinnedPlatform,
    generator,
    datamodelPath,
  })
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
  const nativeOnly = thePlatforms.length === 1 && thePlatforms[0] === 'native'
  await copy({
    from: inputDir,
    to: path.join(outputDir, '/runtime'),
    recursive: true,
    parallelJobs: 20,
    overwrite: true,
  })

  if (!nativeOnly) {
    // native is already downloaded during npm install
    const platformsWithoutNative = thePlatforms.filter(p => p !== 'native')
    if (platformsWithoutNative.length > 0) {
      await download({
        binaries: {
          'query-engine': path.join(__dirname, '../../'),
        },
        platforms: platformsWithoutNative as any[],
        showProgress: true,
        version: theVersion,
      })
    }
  }

  for (const resolvedPlatform of resolvedPlatforms) {
    const binaryName = `query-engine-${resolvedPlatform}`
    const source = path.join(__dirname, '../../', binaryName)
    const target = path.join(outputDir, '/runtime', binaryName)
    debug(`Copying ${source} to ${target}`)
    await copyFile(source, target)
  }

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

export declare var chalk: any
export declare type chalk = any

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

export declare var printStack: any
export declare type printStack = any
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
    if (!fs.existsSync(fileName)) {
      const dir = path.dirname(fileName)
      const newPath = path.join(dir, 'lib', file)
      return newPath
    }
  }

  return fileName
}

function addEsInteropRequire(code: string) {
  const interopCode = `module.exports = Photon; // needed to support const Photon = require('...') in js
Object.defineProperty(module.exports, "__esModule", { value: true });
for (let key in exports) {
  if (exports.hasOwnProperty(key)) {
    module.exports[key] = exports[key];
  }
}`
  const lines = code.split('\n')
  // we now need to reexpose all exports as `exports` is dangling now
  // yes we go through a lot of trouble for our users
  lines.push(interopCode)
  return lines.join('\n')
}
