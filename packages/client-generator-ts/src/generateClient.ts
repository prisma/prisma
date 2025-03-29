import fs from 'node:fs/promises'
import path from 'node:path'

import type * as DMMF from '@prisma/dmmf'
import { overwriteFile } from '@prisma/fetch-engine'
import type { ActiveConnectorType, BinaryPaths, DataSource, GeneratorConfig, SqlQueryOutput } from '@prisma/generator'
import {
  assertNever,
  ClientEngineType,
  EnvPaths,
  getClientEngineType,
  pathToPosix,
  setClassName,
} from '@prisma/internals'
import paths from 'env-paths'
import { glob } from 'fast-glob'
import { ensureDir } from 'fs-extra'
import { bold, red } from 'kleur/colors'
import pkgUp from 'pkg-up'
import type { O } from 'ts-toolbelt'

import { getPrismaClientDMMF } from './getDMMF'
import { BrowserJS, JS, TS, TSClient } from './TSClient'
import { TSClientOptions } from './TSClient/TSClient'
import { buildTypedSql } from './typedSql/typedSql'

export class DenylistError extends Error {
  constructor(message: string) {
    super(message)
    this.stack = undefined
  }
}

setClassName(DenylistError, 'DenylistError')

export interface GenerateClientOptions {
  datamodel: string
  schemaPath: string
  /** Runtime path used in runtime/type imports */
  runtimeBase: string
  outputDir: string
  generator: GeneratorConfig
  dmmf: DMMF.Document
  datasources: DataSource[]
  binaryPaths: BinaryPaths
  engineVersion: string
  clientVersion: string
  activeProvider: ActiveConnectorType
  envPaths?: EnvPaths
  /** When --postinstall is passed via CLI */
  postinstall?: boolean
  /** False when --no-engine is passed via CLI */
  copyEngine?: boolean
  typedSql?: SqlQueryOutput[]
}

export interface FileMap {
  [name: string]: string | FileMap
}

export interface BuildClientResult {
  fileMap: FileMap
  prismaClientDmmf: DMMF.Document
}

export function buildClient({
  schemaPath,
  runtimeBase,
  datamodel,
  binaryPaths,
  outputDir,
  generator,
  dmmf,
  datasources,
  engineVersion,
  clientVersion,
  activeProvider,
  postinstall,
  copyEngine,
  envPaths,
  typedSql,
}: O.Required<GenerateClientOptions, 'runtimeBase'>): BuildClientResult {
  // we define the basic options for the client generation
  const clientEngineType = getClientEngineType(generator)
  const baseClientOptions: Omit<TSClientOptions, 'runtimeName'> = {
    dmmf: getPrismaClientDMMF(dmmf),
    envPaths: envPaths ?? { rootEnvPath: null, schemaEnvPath: undefined },
    datasources,
    generator,
    binaryPaths,
    schemaPath,
    outputDir,
    runtimeBase,
    clientVersion,
    engineVersion,
    activeProvider,
    postinstall,
    copyEngine,
    datamodel,
    browser: false,
    deno: false,
    edge: false,
    wasm: false,
  }

  const nodeClientOptions = {
    ...baseClientOptions,
    runtimeName: getNodeRuntimeName(clientEngineType),
  }

  // we create a regular client that is fit for Node.js
  const nodeClient = new TSClient(nodeClientOptions)

  const defaultClient = new TSClient({
    ...nodeClientOptions,
  })

  // we create a client that is fit for edge runtimes
  const edgeClient = new TSClient({
    ...baseClientOptions,
    runtimeName: 'edge',
    edge: true,
  })

  // we create a client that is fit for react native runtimes
  const rnTsClient = new TSClient({
    ...baseClientOptions,
    runtimeName: 'react-native',
    edge: true,
  })

  // we store the generated contents here
  const fileMap: FileMap = {}
  fileMap['index.js'] = JS(nodeClient)
  fileMap['index.d.ts'] = TS(nodeClient)
  fileMap['default.js'] = JS(defaultClient)
  fileMap['default.d.ts'] = TS(defaultClient)
  fileMap['index-browser.js'] = BrowserJS(nodeClient)
  fileMap['edge.js'] = JS(edgeClient)
  fileMap['edge.d.ts'] = TS(edgeClient)
  fileMap['client.js'] = JS(defaultClient)
  fileMap['client.d.ts'] = TS(defaultClient)

  if (generator.previewFeatures.includes('reactNative')) {
    fileMap['react-native.js'] = JS(rnTsClient)
    fileMap['react-native.d.ts'] = TS(rnTsClient)
  }

  const usesWasmRuntime = generator.previewFeatures.includes('driverAdapters')

  if (usesWasmRuntime) {
    const usesClientEngine = clientEngineType === ClientEngineType.Client

    if (usesClientEngine) {
      fileMap['wasm-worker-loader.mjs'] = `export default import('./query_compiler_bg.wasm')`
      fileMap['wasm-edge-light-loader.mjs'] = `export default import('./query_compiler_bg.wasm?module')`
    } else {
      fileMap['wasm-worker-loader.mjs'] = `export default import('./query_engine_bg.wasm')`
      fileMap['wasm-edge-light-loader.mjs'] = `export default import('./query_engine_bg.wasm?module')`
    }

    const wasmClient = new TSClient({
      ...baseClientOptions,
      runtimeName: 'wasm',
      edge: true,
      wasm: true,
    })

    fileMap['wasm.js'] = JS(wasmClient)
    fileMap['wasm.d.ts'] = TS(wasmClient)
  } else {
    fileMap['wasm.js'] = fileMap['index-browser.js']
    fileMap['wasm.d.ts'] = fileMap['default.d.ts']
  }

  if (generator.previewFeatures.includes('deno') && !!globalThis.Deno) {
    // we create a client that is fit for edge runtimes
    const denoEdgeClient = new TSClient({
      ...baseClientOptions,
      runtimeBase: `../${runtimeBase}`,
      runtimeName: 'edge',
      deno: true,
      edge: true,
    })

    fileMap['deno/edge.js'] = JS(denoEdgeClient)
    fileMap['deno/index.d.ts'] = TS(denoEdgeClient)
    fileMap['deno/edge.ts'] = `
import './polyfill.js'
// @deno-types="./index.d.ts"
export * from './edge.js'`
    fileMap['deno/polyfill.js'] = 'globalThis.process = { env: Deno.env.toObject() }; globalThis.global = globalThis'
  }

  if (typedSql && typedSql.length > 0) {
    fileMap['sql'] = buildTypedSql({
      dmmf,
      runtimeBase: getTypedSqlRuntimeBase(runtimeBase),
      mainRuntimeName: getNodeRuntimeName(clientEngineType),
      queries: typedSql,
      edgeRuntimeName: usesWasmRuntime ? 'wasm' : 'edge',
    })
  }

  return {
    fileMap, // a map of file names to their contents
    prismaClientDmmf: dmmf, // the DMMF document
  }
}

// relativizes runtime import base for typed sql
// absolute path stays unmodified, relative goes up a level
function getTypedSqlRuntimeBase(runtimeBase: string) {
  if (!runtimeBase.startsWith('.')) {
    // absolute path
    return runtimeBase
  }

  if (runtimeBase.startsWith('./')) {
    // replace ./ with ../
    return `.${runtimeBase}`
  }

  return `../${runtimeBase}`
}

export async function generateClient(options: GenerateClientOptions): Promise<void> {
  const {
    datamodel,
    schemaPath,
    generator,
    dmmf,
    datasources,
    binaryPaths,
    clientVersion,
    engineVersion,
    activeProvider,
    postinstall,
    envPaths,
    copyEngine = true,
    typedSql,
  } = options

  const clientEngineType = getClientEngineType(generator)
  const { runtimeBase, outputDir } = await getGenerationDirs(options)

  const { prismaClientDmmf, fileMap } = buildClient({
    datamodel,
    schemaPath,
    runtimeBase,
    outputDir,
    generator,
    dmmf,
    datasources,
    binaryPaths,
    clientVersion,
    engineVersion,
    activeProvider,
    postinstall,
    copyEngine,
    envPaths,
    typedSql,
  })

  const denylistsErrors = validateDmmfAgainstDenylists(prismaClientDmmf)

  if (denylistsErrors) {
    let message = `${bold(
      red('Error: '),
    )}The schema at "${schemaPath}" contains reserved keywords.\n       Rename the following items:`

    for (const error of denylistsErrors) {
      message += '\n         - ' + error.message
    }

    message += `\nTo learn more about how to rename models, check out https://pris.ly/d/naming-models`

    throw new DenylistError(message)
  }

  await deleteOutputDir(outputDir)
  await ensureDir(outputDir)

  if (generator.previewFeatures.includes('deno') && !!globalThis.Deno) {
    await ensureDir(path.join(outputDir, 'deno'))
  }

  await writeFileMap(outputDir, fileMap)

  const enginePath =
    clientEngineType === ClientEngineType.Library ? binaryPaths.libqueryEngine : binaryPaths.queryEngine

  if (!enginePath) {
    throw new Error(
      `Prisma Client needs \`${
        clientEngineType === ClientEngineType.Library ? 'libqueryEngine' : 'queryEngine'
      }\` in the \`binaryPaths\` object.`,
    )
  }

  if (copyEngine) {
    if (process.env.NETLIFY) {
      await ensureDir('/tmp/prisma-engines')
    }

    for (const [binaryTarget, filePath] of Object.entries(enginePath)) {
      const fileName = path.basename(filePath)
      let target: string

      // Introduced in https://github.com/prisma/prisma/pull/6527
      // The engines that are not needed for the runtime deployment on AWS Lambda
      // are moved to `/tmp/prisma-engines`
      // They will be ignored and not included in the final build, reducing its size
      if (process.env.NETLIFY && !['rhel-openssl-1.0.x', 'rhel-openssl-3.0.x'].includes(binaryTarget)) {
        target = path.join('/tmp/prisma-engines', fileName)
      } else {
        target = path.join(outputDir, fileName)
      }

      await overwriteFile(filePath, target)
    }
  }

  const schemaTargetPath = path.join(outputDir, 'schema.prisma')
  await fs.writeFile(schemaTargetPath, datamodel, { encoding: 'utf-8' })

  try {
    // we tell our vscode extension to reload the types by modifying this file
    const prismaCache = paths('prisma').cache
    const signalsPath = path.join(prismaCache, 'last-generate')
    await fs.mkdir(prismaCache, { recursive: true })
    await fs.writeFile(signalsPath, Date.now().toString())
  } catch {}
}

function writeFileMap(outputDir: string, fileMap: FileMap) {
  return Promise.all(
    Object.entries(fileMap).map(async ([fileName, content]) => {
      const absolutePath = path.join(outputDir, fileName)
      // The deletion of the file is necessary, so VSCode
      // picks up the changes.
      await fs.rm(absolutePath, { recursive: true, force: true })
      if (typeof content === 'string') {
        // file
        await fs.writeFile(absolutePath, content)
      } else {
        // subdirectory
        await fs.mkdir(absolutePath)
        await writeFileMap(absolutePath, content)
      }
    }),
  )
}

function validateDmmfAgainstDenylists(prismaClientDmmf: DMMF.Document): Error[] | null {
  const errorArray = [] as Error[]

  const denylists = {
    // A copy of this list is also in prisma-engines. Any edit should be done in both places.
    // https://github.com/prisma/prisma-engines/blob/main/psl/parser-database/src/names/reserved_model_names.rs
    models: [
      // Reserved Prisma keywords
      'PrismaClient',
      'Prisma',
      // JavaScript keywords
      'async',
      'await',
      'break',
      'case',
      'catch',
      'class',
      'const',
      'continue',
      'debugger',
      'default',
      'delete',
      'do',
      'else',
      'enum',
      'export',
      'extends',
      'false',
      'finally',
      'for',
      'function',
      'if',
      'implements',
      'import',
      'in',
      'instanceof',
      'interface',
      'let',
      'new',
      'null',
      'package',
      'private',
      'protected',
      'public',
      'return',
      'super',
      'switch',
      'this',
      'throw',
      'true',
      'try',
      'using',
      'typeof',
      'var',
      'void',
      'while',
      'with',
      'yield',
    ],
    fields: ['AND', 'OR', 'NOT'],
    dynamic: [],
  }

  if (prismaClientDmmf.datamodel.enums) {
    for (const it of prismaClientDmmf.datamodel.enums) {
      if (denylists.models.includes(it.name) || denylists.fields.includes(it.name)) {
        errorArray.push(Error(`"enum ${it.name}"`))
      }
    }
  }

  if (prismaClientDmmf.datamodel.models) {
    for (const it of prismaClientDmmf.datamodel.models) {
      if (denylists.models.includes(it.name) || denylists.fields.includes(it.name)) {
        errorArray.push(Error(`"model ${it.name}"`))
      }
    }
  }

  return errorArray.length > 0 ? errorArray : null
}

/**
 * Get all the directories involved in the generation process.
 */
async function getGenerationDirs({ runtimeBase, outputDir }: GenerateClientOptions) {
  const normalizedOutputDir = path.normalize(outputDir)
  const normalizedRuntimeBase = pathToPosix(runtimeBase)

  const userPackageRoot = await pkgUp({ cwd: path.dirname(normalizedOutputDir) })
  const userProjectRoot = userPackageRoot ? path.dirname(userPackageRoot) : process.cwd()

  return {
    runtimeBase: normalizedRuntimeBase,
    outputDir: normalizedOutputDir,
    projectRoot: userProjectRoot,
  }
}

function getNodeRuntimeName(engineType: ClientEngineType) {
  if (engineType === ClientEngineType.Binary) {
    return 'binary'
  }

  if (engineType === ClientEngineType.Library) {
    return 'library'
  }

  if (engineType === ClientEngineType.Client) {
    if (!process.env.PRISMA_UNSTABLE_CLIENT_ENGINE_TYPE) {
      throw new Error(
        'Unstable Feature: engineType="client" is in a proof of concept phase and not ready to be used publicly yet!',
      )
    }

    return 'client'
  }

  assertNever(engineType, 'Unknown engine type')
}

async function deleteOutputDir(outputDir: string) {
  try {
    const files = await fs.readdir(outputDir)

    if (files.length === 0) {
      return
    }

    // TODO: replace with `client.ts`
    if (!files.includes('client.d.ts')) {
      // Make sure users don't accidentally wipe their source code or home directory.
      throw new Error(
        `${outputDir} exists and is not empty but doesn't look like a generated Prisma Client. ` +
          'Please check your output path and remove the existing directory if you indeed want to generate the Prisma Client in that location.',
      )
    }

    await Promise.allSettled(
      (
        await glob(`${outputDir}/**/*.ts`, {
          globstar: true,
          onlyFiles: true,
          followSymbolicLinks: false,
        })
      ).map(fs.unlink),
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}
