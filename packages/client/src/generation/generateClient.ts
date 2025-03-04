import Debug from '@prisma/debug'
import { overwriteFile } from '@prisma/fetch-engine'
import type {
  ActiveConnectorType,
  BinaryPaths,
  ConnectorType,
  DataSource,
  DMMF,
  GeneratorConfig,
  SqlQueryOutput,
} from '@prisma/generator-helper'
import {
  assertNever,
  ClientEngineType,
  type EnvPaths,
  getClientEngineType,
  pathToPosix,
  setClassName,
} from '@prisma/internals'
import { createHash } from 'node:crypto'
import paths from 'env-paths'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { ensureDir } from 'fs-extra'
import { bold, dim, green, red } from 'kleur/colors'
import path from 'node:path'
import pkgUp from 'pkg-up'
import type { O } from 'ts-toolbelt'

import clientPkg from '../../package.json'
import type { DMMF as PrismaClientDMMF } from './dmmf-types'
import { getPrismaClientDMMF } from './getDMMF'
import { BrowserJS, JS, TS, TSClient } from './TSClient'
import type { TSClientOptions } from './TSClient/TSClient'
import { buildTypedSql } from './typedSql/typedSql'

const debug = Debug('prisma:client:generateClient')

type OutputDeclaration = {
  content: string
  lineNumber: number
}

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
  runtimeBase?: string
  outputDir: string
  generator: GeneratorConfig
  dmmf: DMMF.Document
  datasources: DataSource[]
  binaryPaths: BinaryPaths
  testMode?: boolean
  copyRuntime?: boolean
  copyRuntimeSourceMaps?: boolean
  engineVersion: string
  clientVersion: string
  activeProvider: ActiveConnectorType
  envPaths?: EnvPaths
  /** When --postinstall is passed via CLI */
  postinstall?: boolean
  /** When --no-engine is passed via CLI */
  copyEngine?: boolean
  typedSql?: SqlQueryOutput[]
}

export interface FileMap {
  [name: string]: string | FileMap
}

export interface BuildClientResult {
  fileMap: FileMap
  prismaClientDmmf: PrismaClientDMMF.Document
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function buildClient({
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
}: O.Required<GenerateClientOptions, 'runtimeBase'>): Promise<BuildClientResult> {
  // we define the basic options for the client generation
  const clientEngineType = getClientEngineType(generator)
  const baseClientOptions: Omit<TSClientOptions, `runtimeName${'Js' | 'Ts'}`> = {
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
    runtimeNameJs: getNodeRuntimeName(clientEngineType),
    runtimeNameTs: `${getNodeRuntimeName(clientEngineType)}.js`,
  }

  // we create a regular client that is fit for Node.js
  const nodeClient = new TSClient(nodeClientOptions)

  const defaultClient = new TSClient({
    ...nodeClientOptions,
    reusedTs: 'index',
    reusedJs: '.',
  })

  // we create a client that is fit for edge runtimes
  const edgeClient = new TSClient({
    ...baseClientOptions,
    runtimeNameJs: 'edge',
    runtimeNameTs: 'library.js',
    reusedTs: 'default',
    edge: true,
  })

  // we create a client that is fit for react native runtimes
  const rnTsClient = new TSClient({
    ...baseClientOptions,
    runtimeNameJs: 'react-native',
    runtimeNameTs: 'react-native',
    edge: true,
  })

  const trampolineTsClient = new TSClient({
    ...nodeClientOptions,
    reusedTs: 'index',
    reusedJs: '#main-entry-point',
  })

  // order of keys is important here. bundler/runtime will
  // match the first one they recognize, so it is important
  // to go from more specific to more generic.
  const exportsMapBase = {
    node: './index.js',
    'edge-light': './wasm.js',
    workerd: './wasm.js',
    worker: './wasm.js',
    browser: './index-browser.js',
    default: './index.js',
  }

  const exportsMapDefault = {
    require: exportsMapBase,
    import: exportsMapBase,
    default: exportsMapBase.default,
  }

  const pkgJson = {
    name: getUniquePackageName(datamodel),
    main: 'index.js',
    types: 'index.d.ts',
    browser: 'index-browser.js',
    exports: {
      ...clientPkg.exports,
      // TODO: remove on DA ga
      ...{ '.': exportsMapDefault },
    },
    version: clientVersion,
    sideEffects: false,
  }

  // we store the generated contents here
  const fileMap: FileMap = {}
  fileMap['index.js'] = JS(nodeClient)
  fileMap['index.d.ts'] = TS(nodeClient)
  fileMap['default.js'] = JS(defaultClient)
  fileMap['default.d.ts'] = TS(defaultClient)
  fileMap['index-browser.js'] = BrowserJS(nodeClient)
  fileMap['edge.js'] = JS(edgeClient)
  fileMap['edge.d.ts'] = TS(edgeClient)

  if (generator.previewFeatures.includes('reactNative')) {
    fileMap['react-native.js'] = JS(rnTsClient)
    fileMap['react-native.d.ts'] = TS(rnTsClient)
  }

  const usesWasmRuntime = generator.previewFeatures.includes('driverAdapters')

  if (usesWasmRuntime) {
    const usesClientEngine = clientEngineType === ClientEngineType.Client

    // The trampoline client points to #main-entry-point (see below).  We use
    // imports similar to an exports map to ensure correct imports.❗ Before
    // going GA, please notify @millsp as some things can be cleaned up:
    // - defaultClient can be deleted since trampolineTsClient will replace it.
    //   - Special handling of . paths in TSClient.ts can also be removed.
    // - The main @prisma/client exports map can be simplified:
    //   - Everything can point to `default.js`, including browser fields.
    //   - Exports map's `.` entry can be made like the others (e.g. `./edge`).
    // - exportsMapDefault can be deleted as it's only needed for defaultClient:
    //   - #main-entry-point can handle all the heavy lifting on its own.
    //   - Always using #main-entry-point is kept for GA (small breaking change).
    //   - exportsMapDefault can be inlined down below and MUST be removed elsewhere.
    // In short: A lot can be simplified, but can only happen in GA & P6.
    fileMap['default.js'] = JS(trampolineTsClient)
    fileMap['default.d.ts'] = TS(trampolineTsClient)
    if (usesClientEngine) {
      fileMap['wasm-worker-loader.mjs'] = `export default import('./query_compiler_bg.wasm')`
      fileMap['wasm-edge-light-loader.mjs'] = `export default import('./query_compiler_bg.wasm?module')`
    } else {
      fileMap['wasm-worker-loader.mjs'] = `export default import('./query_engine_bg.wasm')`
      fileMap['wasm-edge-light-loader.mjs'] = `export default import('./query_engine_bg.wasm?module')`
    }

    pkgJson.browser = 'default.js' // also point to the trampoline client otherwise it is picked up by cfw
    pkgJson.imports = {
      // when `import('#wasm-engine-loader')` or `import('#wasm-compiler-loader')` is called, it will be resolved to the correct file
      [usesClientEngine ? '#wasm-compiler-loader' : '#wasm-engine-loader']: {
        // Keys reference: https://runtime-keys.proposal.wintercg.org/#keys

        /**
         * Vercel Edge Functions / Next.js Middlewares
         */
        'edge-light': './wasm-edge-light-loader.mjs',

        /**
         * Cloudflare Workers, Cloudflare Pages
         */
        workerd: './wasm-worker-loader.mjs',

        /**
         * (Old) Cloudflare Workers
         * @millsp It's a fallback, in case both other keys didn't work because we could be on a different edge platform. It's a hypothetical case rather than anything actually tested.
         */
        worker: './wasm-worker-loader.mjs',

        /**
         * Fallback for every other JavaScript runtime
         */
        default: './wasm-worker-loader.mjs',
      },
      // when `require('#main-entry-point')` is called, it will be resolved to the correct file
      '#main-entry-point': exportsMapDefault,
    }

    const wasmClient = new TSClient({
      ...baseClientOptions,
      runtimeNameJs: 'wasm',
      runtimeNameTs: 'library.js',
      reusedTs: 'default',
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
      runtimeNameJs: 'edge-esm',
      runtimeNameTs: 'library.d.ts',
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
    const edgeRuntimeName = usesWasmRuntime ? 'wasm' : 'edge'
    const cjsEdgeIndex = `./sql/index.${edgeRuntimeName}.js`
    const esmEdgeIndex = `./sql/index.${edgeRuntimeName}.mjs`
    pkgJson.exports['./sql'] = {
      require: {
        types: './sql/index.d.ts',
        'edge-light': cjsEdgeIndex,
        workerd: cjsEdgeIndex,
        worker: cjsEdgeIndex,
        node: './sql/index.js',
        default: './sql/index.js',
      },
      import: {
        types: './sql/index.d.ts',
        'edge-light': esmEdgeIndex,
        workerd: esmEdgeIndex,
        worker: esmEdgeIndex,
        node: './sql/index.mjs',
        default: './sql/index.mjs',
      },
      default: './sql/index.js',
    } as any
    fileMap.sql = buildTypedSql({
      dmmf,
      runtimeBase: getTypedSqlRuntimeBase(runtimeBase),
      mainRuntimeName: getNodeRuntimeName(clientEngineType),
      queries: typedSql,
      edgeRuntimeName,
    })
  }
  fileMap['package.json'] = JSON.stringify(pkgJson, null, 2)

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

// TODO: explore why we have a special case for excluding pnpm
async function getDefaultOutdir(outputDir: string): Promise<string> {
  if (outputDir.endsWith(path.normalize('node_modules/@prisma/client'))) {
    return path.join(outputDir, '../../.prisma/client')
  }
  if (
    process.env.INIT_CWD &&
    process.env.npm_lifecycle_event === 'postinstall' &&
    !process.env.PWD?.includes('.pnpm')
  ) {
    // INIT_CWD is the dir, in which "npm install" has been invoked. That can e.g. be in ./src
    // If we're in ./ - there'll also be a package.json, so we can directly go for it
    // otherwise, we'll go up in the filesystem and look for the first package.json
    if (existsSync(path.join(process.env.INIT_CWD, 'package.json'))) {
      return path.join(process.env.INIT_CWD, 'node_modules/.prisma/client')
    }
    const packagePath = await pkgUp({ cwd: process.env.INIT_CWD })
    if (packagePath) {
      return path.join(path.dirname(packagePath), 'node_modules/.prisma/client')
    }
  }

  return path.join(outputDir, '../../.prisma/client')
}

export async function generateClient(options: GenerateClientOptions): Promise<void> {
  const {
    datamodel,
    schemaPath,
    generator,
    dmmf,
    datasources,
    binaryPaths,
    testMode,
    copyRuntime,
    copyRuntimeSourceMaps = false,
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

  const { prismaClientDmmf, fileMap } = await buildClient({
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
    testMode,
    envPaths,
    typedSql,
  })

  const provider = datasources[0].provider

  const denylistsErrors = validateDmmfAgainstDenylists(prismaClientDmmf)

  if (denylistsErrors) {
    let message = `${bold(
      red('Error: '),
    )}The schema at "${schemaPath}" contains reserved keywords.\n       Rename the following items:`

    for (const error of denylistsErrors) {
      message += `\n         - ${error.message}`
    }

    message += '\nTo learn more about how to rename models, check out https://pris.ly/d/naming-models'

    throw new DenylistError(message)
  }

  if (!copyEngine) {
    await deleteOutputDir(outputDir)
  }

  await ensureDir(outputDir)
  if (generator.previewFeatures.includes('deno') && !!globalThis.Deno) {
    await ensureDir(path.join(outputDir, 'deno'))
  }

  await writeFileMap(outputDir, fileMap)

  const runtimeDir = path.join(__dirname, `${testMode ? '../' : ''}../runtime`)

  // if users use a custom output dir
  if (copyRuntime || generator.isCustomOutput === true) {
    const copiedRuntimeDir = path.join(outputDir, 'runtime')
    await ensureDir(copiedRuntimeDir)

    await copyRuntimeFiles({
      from: runtimeDir,
      to: copiedRuntimeDir,
      sourceMaps: copyRuntimeSourceMaps,
      runtimeName: getNodeRuntimeName(clientEngineType),
    })
  }

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

  // copy the necessary engine files needed for the wasm/driver-adapter engine
  if (
    generator.previewFeatures.includes('driverAdapters') &&
    isWasmEngineSupported(provider) &&
    copyEngine &&
    !testMode
  ) {
    const suffix = provider === 'postgres' ? 'postgresql' : provider
    const filename = clientEngineType === ClientEngineType.Client ? 'query_compiler_bg' : 'query_engine_bg'
    await fs.copyFile(path.join(runtimeDir, `${filename}.${suffix}.wasm`), path.join(outputDir, `${filename}.wasm`))
    await fs.copyFile(path.join(runtimeDir, `${filename}.${suffix}.js`), path.join(outputDir, `${filename}.js`))
  }

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

function isWasmEngineSupported(provider: ConnectorType) {
  return provider === 'postgresql' || provider === 'postgres' || provider === 'mysql' || provider === 'sqlite'
}

function validateDmmfAgainstDenylists(prismaClientDmmf: PrismaClientDMMF.Document): Error[] | null {
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
 *
 * @returns
 */
async function getGenerationDirs({
  runtimeBase,
  generator,
  outputDir,
  datamodel,
  schemaPath,
  testMode,
}: GenerateClientOptions) {
  const isCustomOutput = generator.isCustomOutput === true
  const normalizedOutputDir = path.normalize(outputDir)
  let userRuntimeImport = isCustomOutput ? './runtime' : '@prisma/client/runtime'
  let userOutputDir = isCustomOutput ? normalizedOutputDir : await getDefaultOutdir(normalizedOutputDir)

  if (testMode && runtimeBase) {
    userOutputDir = outputDir
    userRuntimeImport = pathToPosix(runtimeBase)
  }

  if (isCustomOutput) {
    await verifyOutputDirectory(userOutputDir, datamodel, schemaPath)
  }

  const userPackageRoot = await pkgUp({ cwd: path.dirname(userOutputDir) })
  const userProjectRoot = userPackageRoot ? path.dirname(userPackageRoot) : process.cwd()

  return {
    runtimeBase: userRuntimeImport,
    outputDir: userOutputDir,
    projectRoot: userProjectRoot,
  }
}

async function verifyOutputDirectory(directory: string, datamodel: string, schemaPath: string) {
  let content: string
  try {
    content = await fs.readFile(path.join(directory, 'package.json'), 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') {
      // no package.json exists, we are good
      return
    }
    throw e
  }
  const { name } = JSON.parse(content)
  if (name === clientPkg.name) {
    const message = [`Generating client into ${bold(directory)} is not allowed.`]
    message.push('This package is used by `prisma generate` and overwriting its content is dangerous.')
    message.push('')
    message.push('Suggestion:')
    const outputDeclaration = findOutputPathDeclaration(datamodel)

    if (outputDeclaration?.content.includes(clientPkg.name)) {
      const outputLine = outputDeclaration.content
      message.push(`In ${bold(schemaPath)} replace:`)
      message.push('')
      message.push(`${dim(outputDeclaration.lineNumber)} ${replacePackageName(outputLine, red(clientPkg.name))}`)
      message.push('with')

      message.push(`${dim(outputDeclaration.lineNumber)} ${replacePackageName(outputLine, green('.prisma/client'))}`)
    } else {
      message.push(`Generate client into ${bold(replacePackageName(directory, green('.prisma/client')))} instead`)
    }

    message.push('')
    message.push("You won't need to change your imports.")
    message.push('Imports from `@prisma/client` will be automatically forwarded to `.prisma/client`')
    const error = new Error(message.join('\n'))
    throw error
  }
}

function replacePackageName(directoryPath: string, replacement: string): string {
  return directoryPath.replace(clientPkg.name, replacement)
}

function findOutputPathDeclaration(datamodel: string): OutputDeclaration | null {
  const lines = datamodel.split(/\r?\n/)

  for (const [i, line] of lines.entries()) {
    if (/output\s*=/.test(line)) {
      return { lineNumber: i + 1, content: line.trim() }
    }
  }
  return null
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

type CopyRuntimeOptions = {
  from: string
  to: string
  runtimeName: string
  sourceMaps: boolean
}

async function copyRuntimeFiles({ from, to, runtimeName, sourceMaps }: CopyRuntimeOptions) {
  const files = [
    // library.d.ts is always included, as it contains the actual runtime type
    // definitions. Rest of the `runtime.d.ts` files just re-export everything
    // from `library.d.ts`
    'library.d.ts',
    'index-browser.js',
    'index-browser.d.ts',
    'edge.js',
    'edge-esm.js',
    'react-native.js',
    'wasm.js',
  ]

  files.push(`${runtimeName}.js`)
  if (runtimeName !== 'library') {
    files.push(`${runtimeName}.d.ts`)
  }

  if (sourceMaps) {
    files.push(...files.filter((file) => file.endsWith('.js')).map((file) => `${file}.map`))
  }

  await Promise.all(files.map((file) => fs.copyFile(path.join(from, file), path.join(to, file))))
}

/**
 * Attempts to delete the output directory.
 * @param outputDir
 */
async function deleteOutputDir(outputDir: string) {
  try {
    debug(`attempting to delete ${outputDir} recursively`)
    // we want to make sure that if we delete, we delete the right directory
    if (require(`${outputDir}/package.json`).name?.startsWith(GENERATED_PACKAGE_NAME_PREFIX)) {
      await fs.rmdir(outputDir, { recursive: true }).catch(() => {
        debug(`failed to delete ${outputDir} recursively`)
      })
    }
  } catch {
    debug(`failed to delete ${outputDir} recursively, not found`)
  }
}

/**
 * This function ensures that each generated client has unique package name
 * It appends sha256 of the schema to the fixed prefix. That ensures unique schemas
 * produce unique generated packages while still keeping `generate` results reproducible.
 *
 * Without unique package name, if you have several TS clients in the project, TS Compiler
 * might merge different `Prisma` namespace declarations together and produce unusable results.
 *
 * @param datamodel
 * @returns
 */
function getUniquePackageName(datamodel: string) {
  const hash = createHash('sha256')
  hash.write(datamodel)
  return `${GENERATED_PACKAGE_NAME_PREFIX}${hash.digest().toString('hex')}`
}

const GENERATED_PACKAGE_NAME_PREFIX = 'prisma-client-'
