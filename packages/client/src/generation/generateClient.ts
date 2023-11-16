import Debug from '@prisma/debug'
import { overwriteFile } from '@prisma/fetch-engine'
import type { BinaryPaths, DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper'
import { assertNever, ClientEngineType, getClientEngineType, Platform, setClassName } from '@prisma/internals'
import paths from 'env-paths'
import { existsSync } from 'fs'
import fs from 'fs/promises'
import { ensureDir } from 'fs-extra'
import { bold, dim, green, red } from 'kleur/colors'
import path from 'path'
import pkgUp from 'pkg-up'
import type { O } from 'ts-toolbelt'

import { name as clientPackageName } from '../../package.json'
import type { DMMF as PrismaClientDMMF } from './dmmf-types'
import { getPrismaClientDMMF } from './getDMMF'
import { BrowserJS, JS, TS, TSClient } from './TSClient'
import type { Dictionary } from './utils/common'

const GENERATED_PACKAGE_NAME = '.prisma/client'
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
  projectRoot?: string
  datamodel: string
  schemaPath: string
  transpile?: boolean
  runtimeDirs?: { node: string; edge: string }
  outputDir: string
  generator?: GeneratorConfig
  dmmf: DMMF.Document
  datasources: DataSource[]
  binaryPaths: BinaryPaths
  testMode?: boolean
  copyRuntime?: boolean
  copyRuntimeSourceMaps?: boolean
  engineVersion: string
  clientVersion: string
  activeProvider: string
  postinstall?: boolean
  overrideEngineType?: ClientEngineType
  noEngine?: boolean
}

export interface BuildClientResult {
  fileMap: Dictionary<string>
  prismaClientDmmf: PrismaClientDMMF.Document
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function buildClient({
  schemaPath,
  runtimeDirs,
  binaryPaths,
  outputDir,
  generator,
  dmmf,
  datasources,
  engineVersion,
  clientVersion,
  projectRoot,
  activeProvider,
  postinstall,
  overrideEngineType,
  noEngine,
}: O.Required<GenerateClientOptions, 'runtimeDirs'>): Promise<BuildClientResult> {
  // we define the basic options for the client generation
  const document = getPrismaClientDMMF(dmmf)
  const clientEngineType = overrideEngineType ?? getClientEngineType(generator!)
  const tsClientOptions = {
    document,
    datasources,
    generator,
    platforms:
      clientEngineType === ClientEngineType.Library
        ? (Object.keys(binaryPaths.libqueryEngine ?? {}) as Platform[])
        : (Object.keys(binaryPaths.queryEngine ?? {}) as Platform[]),
    schemaPath,
    outputDir,
    clientVersion,
    engineVersion,
    projectRoot: projectRoot!,
    activeProvider,
    postinstall,
    noEngine,
  }

  // we create a regular client that is fit for Node.js
  const nodeTsClient = new TSClient({
    ...tsClientOptions,
    runtimeName: getNodeRuntimeName(clientEngineType),
    runtimeDir: runtimeDirs.node,
  })

  // we create a client that is fit for edge runtimes
  const edgeTsClient = new TSClient({
    ...tsClientOptions,
    runtimeName: 'edge',
    runtimeDir: runtimeDirs.edge,
  })

  const fileMap = {} // we will store the generated contents here

  // we generate the default client that is meant to work on Node
  fileMap['index.js'] = await JS(nodeTsClient, false)
  fileMap['index.d.ts'] = await TS(nodeTsClient)
  fileMap['index-browser.js'] = await BrowserJS(nodeTsClient)
  fileMap['package.json'] = JSON.stringify(
    {
      name: GENERATED_PACKAGE_NAME,
      main: 'index.js',
      types: 'index.d.ts',
      browser: 'index-browser.js',
      sideEffects: false,
    },
    null,
    2,
  )

  fileMap['edge.js'] = await JS(edgeTsClient, true)
  fileMap['edge.d.ts'] = await TS(edgeTsClient, true)

  if (generator?.previewFeatures.includes('deno') && !!globalThis.Deno) {
    // we create a client that is fit for edge runtimes
    const denoEdgeTsClient = new TSClient({
      ...tsClientOptions,
      runtimeName: 'library.d.ts',
      runtimeDir: '../' + runtimeDirs.edge,
      deno: true,
    })

    fileMap['deno/edge.js'] = await JS(denoEdgeTsClient, true)
    fileMap['deno/index.d.ts'] = await TS(denoEdgeTsClient)
    fileMap['deno/edge.ts'] = `
import './polyfill.js'
// @deno-types="./index.d.ts"
export * from './edge.js'`
    fileMap['deno/polyfill.js'] = 'globalThis.process = { env: Deno.env.toObject() }; globalThis.global = globalThis'
  }

  return {
    fileMap, // a map of file names to their contents
    prismaClientDmmf: document, // the DMMF document
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
    outputDir,
    transpile,
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
    overrideEngineType,
    noEngine,
  } = options

  const clientEngineType = overrideEngineType ?? getClientEngineType(generator!)
  const { runtimeDirs, finalOutputDir, projectRoot } = await getGenerationDirs(options)

  const { prismaClientDmmf, fileMap } = await buildClient({
    datamodel,
    schemaPath,
    transpile,
    runtimeDirs,
    outputDir: finalOutputDir,
    generator,
    dmmf,
    datasources,
    binaryPaths,
    clientVersion,
    engineVersion,
    projectRoot,
    activeProvider,
    postinstall,
    overrideEngineType,
    noEngine,
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

  if (noEngine === true) {
    await deleteOutputDir(finalOutputDir)
  }

  await ensureDir(finalOutputDir)
  await ensureDir(path.join(outputDir, 'runtime'))
  if (generator?.previewFeatures.includes('deno') && !!globalThis.Deno) {
    await ensureDir(path.join(outputDir, 'deno'))
  }
  // TODO: why do we sometimes use outputDir and sometimes finalOutputDir?
  // outputDir:       /home/millsp/Work/prisma/packages/client
  // finalOutputDir:  /home/millsp/Work/prisma/.prisma/client

  await Promise.all(
    Object.entries(fileMap).map(async ([fileName, file]) => {
      const filePath = path.join(finalOutputDir, fileName)
      // The deletion of the file is necessary, so VSCode
      // picks up the changes.
      if (existsSync(filePath)) {
        await fs.unlink(filePath)
      }
      await fs.writeFile(filePath, file)
    }),
  )
  const runtimeSourceDir: string = testMode
    ? eval(`require('path').join(__dirname, '../../runtime')`)
    : eval(`require('path').join(__dirname, '../runtime')`)

  // if users use a custom output dir
  if (copyRuntime || !path.resolve(outputDir).endsWith(`@prisma${path.sep}client`)) {
    const copyTarget = path.join(outputDir, 'runtime')
    await ensureDir(copyTarget)
    if (runtimeSourceDir !== copyTarget) {
      await copyRuntimeFiles({
        from: runtimeSourceDir,
        to: copyTarget,
        sourceMaps: copyRuntimeSourceMaps,
        runtimeName: getNodeRuntimeName(clientEngineType),
      })
    }
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

  if (transpile === true && noEngine !== true && getClientEngineType(generator) !== ClientEngineType.Wasm) {
    if (process.env.NETLIFY) {
      await ensureDir('/tmp/prisma-engines')
    }

    for (const [binaryTarget, filePath] of Object.entries(enginePath)) {
      const fileName = path.basename(filePath)
      const target =
        process.env.NETLIFY && binaryTarget !== 'rhel-openssl-1.0.x'
          ? path.join('/tmp/prisma-engines', fileName)
          : path.join(finalOutputDir, fileName)
      await overwriteFile(filePath, target)
    }
  }

  const schemaTargetPath = path.join(finalOutputDir, 'schema.prisma')
  if (schemaPath !== schemaTargetPath) {
    await fs.copyFile(schemaPath, schemaTargetPath)
  }

  // copy the necessary engine files needed for the wasm/driver-adapter engine
  if (getClientEngineType(generator) === ClientEngineType.Wasm) {
    const queryEngineWasmFilePath = path.join(runtimeSourceDir, 'query-engine.wasm')
    const queryEngineWasmTargetPath = path.join(finalOutputDir, 'query-engine.wasm')
    await fs.copyFile(queryEngineWasmFilePath, queryEngineWasmTargetPath)
  }

  const proxyIndexJsPath = path.join(outputDir, 'index.js')
  const proxyIndexBrowserJsPath = path.join(outputDir, 'index-browser.js')
  const proxyIndexDTSPath = path.join(outputDir, 'index.d.ts')
  if (!existsSync(proxyIndexJsPath)) {
    await fs.copyFile(path.join(__dirname, '../../index.js'), proxyIndexJsPath)
  }

  if (!existsSync(proxyIndexDTSPath)) {
    await fs.copyFile(path.join(__dirname, '../../index.d.ts'), proxyIndexDTSPath)
  }

  if (!existsSync(proxyIndexBrowserJsPath)) {
    await fs.copyFile(path.join(__dirname, '../../index-browser.js'), proxyIndexBrowserJsPath)
  }

  try {
    // we tell our vscode extension to reload the types by modifying this file
    const prismaCache = paths('prisma').cache
    const signalsPath = path.join(prismaCache, 'last-generate')
    await fs.mkdir(prismaCache, { recursive: true })
    await fs.writeFile(signalsPath, Date.now().toString())
  } catch {}
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
 * @param useDefaultOutdir if we are generating to the default output
 * @param runtimeDirs overrides for the runtime directories
 * @returns
 */
async function getGenerationDirs({
  testMode,
  runtimeDirs,
  generator,
  outputDir,
  datamodel,
  schemaPath,
}: GenerateClientOptions) {
  const useDefaultOutdir = testMode ? !runtimeDirs : !generator?.isCustomOutput

  const _runtimeDirs = {
    // if we have an override, we use it, but if not then use the defaults
    node: runtimeDirs?.node || (useDefaultOutdir ? '@prisma/client/runtime' : './runtime'),
    edge: runtimeDirs?.edge || (useDefaultOutdir ? '@prisma/client/runtime' : './runtime'),
  }

  const finalOutputDir = useDefaultOutdir ? await getDefaultOutdir(outputDir) : outputDir
  if (!useDefaultOutdir) {
    await verifyOutputDirectory(finalOutputDir, datamodel, schemaPath)
  }

  const packageRoot = await pkgUp({ cwd: path.dirname(finalOutputDir) })
  const projectRoot = packageRoot ? path.dirname(packageRoot) : process.cwd()

  return {
    runtimeDirs: _runtimeDirs,
    finalOutputDir,
    projectRoot,
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

function getNodeRuntimeName(engineType: ClientEngineType): string {
  if (engineType === ClientEngineType.Binary) {
    return 'binary'
  }

  if (engineType === ClientEngineType.Library) {
    return 'library'
  }

  // the wasm engine fully depends on the library engine
  if (engineType === ClientEngineType.Wasm) {
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
    // library.d.ts is always included, because
    // it contains the actual runtime type definitions. Rest of
    // the `runtime.d.ts` files just re-export everything from `library.d.ts`
    'library.d.ts',
    'index-browser.js',
    'index-browser.d.ts',
    'edge.js',
    'edge-esm.js',
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
 * @param finalOutputDir
 */
async function deleteOutputDir(finalOutputDir: string) {
  try {
    debug(`attempting to delete ${finalOutputDir} recursively`)
    // we want to make sure that if we delete, we delete the right directory
    if (require(`${finalOutputDir}/package.json`).name === GENERATED_PACKAGE_NAME) {
      await fs.rmdir(finalOutputDir, { recursive: true }).catch(() => {
        debug(`failed to delete ${finalOutputDir} recursively`)
      })
    }
  } catch {
    debug(`failed to delete ${finalOutputDir} recursively, not found`)
  }
}
