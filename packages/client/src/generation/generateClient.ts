import Debug from '@prisma/debug'
import { overwriteFile } from '@prisma/fetch-engine'
import type { BinaryPaths, ConnectorType, DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper'
import { assertNever, ClientEngineType, getClientEngineType, pathToPosix, setClassName } from '@prisma/internals'
import { createHash } from 'crypto'
import paths from 'env-paths'
import { existsSync } from 'fs'
import fs from 'fs/promises'
import { ensureDir } from 'fs-extra'
import { bold, dim, green, red } from 'kleur/colors'
import path from 'path'
import pkgUp from 'pkg-up'
import type { O } from 'ts-toolbelt'

import { exports as clientPackageExports, name as clientPackageName } from '../../package.json'
import type { DMMF as PrismaClientDMMF } from './dmmf-types'
import { getPrismaClientDMMF } from './getDMMF'
import { BrowserJS, JS, TS, TSClient } from './TSClient'
import { TSClientOptions } from './TSClient/TSClient'
import type { Dictionary } from './utils/common'

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
  activeProvider: string
  /** When --postinstall is passed via CLI */
  postinstall?: boolean
  /** When --no-engine is passed via CLI */
  copyEngine?: boolean
}

export interface BuildClientResult {
  fileMap: Dictionary<string>
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
}: O.Required<GenerateClientOptions, 'runtimeBase'>): Promise<BuildClientResult> {
  // we define the basic options for the client generation
  const clientEngineType = getClientEngineType(generator)
  const baseClientOptions: Omit<TSClientOptions, `runtimeName${'Js' | 'Ts'}`> = {
    dmmf: getPrismaClientDMMF(dmmf),
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
    importWarning: false,
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
    reusedJs: 'index',
  })

  // we create a client that is fit for edge runtimes
  const edgeClient = new TSClient({
    ...baseClientOptions,
    runtimeNameJs: 'edge',
    runtimeNameTs: 'library.js',
    reusedTs: 'default',
    edge: true,
  })

  const pkgJson = {
    name: getUniquePackageName(datamodel),
    main: 'index.js',
    types: 'index.d.ts',
    browser: 'index-browser.js',
    exports: clientPackageExports,
    version: clientVersion,
    sideEffects: false,
  }

  // we store the generated contents here
  const fileMap: Record<string, string> = {}
  fileMap['index.js'] = await JS(nodeClient)
  fileMap['index.d.ts'] = await TS(nodeClient)
  fileMap['default.js'] = await JS(defaultClient)
  fileMap['default.d.ts'] = await TS(defaultClient)
  fileMap['index-browser.js'] = await BrowserJS(nodeClient)
  fileMap['package.json'] = JSON.stringify(pkgJson, null, 2)
  fileMap['edge.js'] = await JS(edgeClient)
  fileMap['edge.d.ts'] = await TS(edgeClient)

  if (generator.previewFeatures.includes('driverAdapters')) {
    // in custom outputs, `index` shows a warning. if it is loaded, it means
    // that the export map is not working for the user so we display them an
    // `importWarning`. If the exports map works, `default` will be loaded.
    if (generator.isCustomOutput === true) {
      const nodeWarnTsClient = new TSClient({
        ...nodeClientOptions,
        reusedTs: 'default',
        reusedJs: 'default',
        importWarning: true,
      })

      fileMap['default.js'] = fileMap['index.js']
      fileMap['default.d.ts'] = fileMap['index.d.ts']
      fileMap['index.js'] = await JS(nodeWarnTsClient)
      fileMap['index.d.ts'] = await TS(nodeWarnTsClient)
    }

    const wasmClient = new TSClient({
      ...baseClientOptions,
      runtimeNameJs: 'wasm',
      runtimeNameTs: 'library.js',
      reusedTs: 'default',
      edge: true,
      wasm: true,
    })

    fileMap['wasm.js'] = await JS(wasmClient)
    fileMap['wasm.d.ts'] = await TS(wasmClient)
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

    fileMap['deno/edge.js'] = await JS(denoEdgeClient)
    fileMap['deno/index.d.ts'] = await TS(denoEdgeClient)
    fileMap['deno/edge.ts'] = `
import './polyfill.js'
// @deno-types="./index.d.ts"
export * from './edge.js'`
    fileMap['deno/polyfill.js'] = 'globalThis.process = { env: Deno.env.toObject() }; globalThis.global = globalThis'
  }

  return {
    fileMap, // a map of file names to their contents
    prismaClientDmmf: dmmf, // the DMMF document
  }
}

// TODO: explore why we have a special case for excluding pnpm
async function getDefaultOutdir(outputDir: string): Promise<string> {
  if (outputDir.endsWith('node_modules/@prisma/client')) {
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
    copyEngine = true,
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
  })

  const provider = datasources[0].provider

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

  if (!copyEngine) {
    await deleteOutputDir(outputDir)
  }

  await ensureDir(outputDir)
  if (generator.previewFeatures.includes('deno') && !!globalThis.Deno) {
    await ensureDir(path.join(outputDir, 'deno'))
  }

  await Promise.all(
    Object.entries(fileMap).map(async ([fileName, file]) => {
      const filePath = path.join(outputDir, fileName)
      // The deletion of the file is necessary, so VSCode
      // picks up the changes.
      if (existsSync(filePath)) {
        await fs.unlink(filePath)
      }
      await fs.writeFile(filePath, file)
    }),
  )

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
  if (schemaPath !== schemaTargetPath) {
    await fs.copyFile(schemaPath, schemaTargetPath)
  }

  // copy the necessary engine files needed for the wasm/driver-adapter engine
  if (
    generator.previewFeatures.includes('driverAdapters') &&
    isWasmEngineSupported(provider) &&
    copyEngine &&
    !testMode
  ) {
    const suffix = provider === 'postgres' ? 'postgresql' : provider
    await fs.copyFile(
      path.join(runtimeDir, `query_engine_bg.${suffix}.wasm`),
      path.join(outputDir, `query_engine_bg.wasm`),
    )

    await fs.copyFile(path.join(runtimeDir, `query_engine_bg.${suffix}.js`), path.join(outputDir, `query_engine_bg.js`))
  }

  try {
    // we tell our vscode extension to reload the types by modifying this file
    const prismaCache = paths('prisma').cache
    const signalsPath = path.join(prismaCache, 'last-generate')
    await fs.mkdir(prismaCache, { recursive: true })
    await fs.writeFile(signalsPath, Date.now().toString())
  } catch {}
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
  let userRuntimeImport = isCustomOutput ? './runtime' : '@prisma/client/runtime'
  let userOutputDir = isCustomOutput ? outputDir : await getDefaultOutdir(outputDir)

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
  if (name === clientPackageName) {
    const message = [`Generating client into ${bold(directory)} is not allowed.`]
    message.push('This package is used by `prisma generate` and overwriting its content is dangerous.')
    message.push('')
    message.push('Suggestion:')
    const outputDeclaration = findOutputPathDeclaration(datamodel)

    if (outputDeclaration && outputDeclaration.content.includes(clientPackageName)) {
      const outputLine = outputDeclaration.content
      message.push(`In ${bold(schemaPath)} replace:`)
      message.push('')
      message.push(`${dim(outputDeclaration.lineNumber)} ${replacePackageName(outputLine, red(clientPackageName))}`)
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
  return directoryPath.replace(clientPackageName, replacement)
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
