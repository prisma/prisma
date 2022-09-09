import { BinaryType, overwriteFile } from '@prisma/fetch-engine'
import type { BinaryPaths, DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper'
import type { Platform } from '@prisma/internals'
import { ClientEngineType, getClientEngineType, getEngineVersion } from '@prisma/internals'
import copy from '@timsuchanek/copy'
import chalk from 'chalk'
import fs from 'fs'
import makeDir from 'make-dir'
import path from 'path'
import pkgUp from 'pkg-up'
import type { O } from 'ts-toolbelt'
import { promisify } from 'util'

import { name as clientPackageName } from '../../package.json'
import type { DMMF as PrismaClientDMMF } from '../runtime/dmmf-types'
import type { Dictionary } from '../runtime/utils/common'
import { getPrismaClientDMMF } from './getDMMF'
import { BrowserJS, JS, TS, TSClient } from './TSClient'

const remove = promisify(fs.unlink)
const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)
const copyFile = promisify(fs.copyFile)
const stat = promisify(fs.stat)

const GENERATED_PACKAGE_NAME = '.prisma/client'

type OutputDeclaration = {
  content: string
  lineNumber: number
}

export class DenylistError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DenylistError'
    this.stack = undefined
  }
}

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
  engineVersion: string
  clientVersion: string
  activeProvider: string
  dataProxy: boolean
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
  dataProxy,
}: O.Required<GenerateClientOptions, 'runtimeDirs'>): Promise<BuildClientResult> {
  // we define the basic options for the client generation
  const document = getPrismaClientDMMF(dmmf)
  const clientEngineType = getClientEngineType(generator!)
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
    dataProxy,
  }

  // we create a regular client that is fit for Node.js
  const nodeTsClient = new TSClient({
    ...tsClientOptions,
    runtimeName: 'index',
    runtimeDir: runtimeDirs.node,
  })

  // we create a client that is fit for edge runtimes
  const edgeTsClient = new TSClient({
    ...tsClientOptions,
    dataProxy: true, // edge only works w/ data proxy
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
    },
    null,
    2,
  )

  // we only generate the edge client if `--data-proxy` is passed
  if (dataProxy === true) {
    fileMap['edge.js'] = await JS(edgeTsClient, true)
    fileMap['edge.d.ts'] = await TS(edgeTsClient, true)
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
    if (fs.existsSync(path.join(process.env.INIT_CWD, 'package.json'))) {
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
    clientVersion,
    engineVersion,
    activeProvider,
    dataProxy,
  } = options

  const clientEngineType = getClientEngineType(generator!)
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
    dataProxy,
  })

  // TODO put this into the generator?
  const denylistsErrors = validateDmmfAgainstDenylists(prismaClientDmmf)

  if (denylistsErrors) {
    let message = `${chalk.redBright.bold(
      'Error: ',
    )}The schema at "${schemaPath}" contains reserved keywords.\n       Rename the following items:`

    for (const error of denylistsErrors) {
      message += '\n         - ' + error.message
    }

    message += `\nTo learn more about how to rename models, check out https://pris.ly/d/naming-models`

    throw new DenylistError(message)
  }

  await makeDir(finalOutputDir)
  await makeDir(path.join(outputDir, 'runtime'))
  // TODO: why do we sometimes use outputDir and sometimes finalOutputDir?
  // outputDir:       /home/millsp/Work/prisma/packages/client
  // finalOutputDir:  /home/millsp/Work/prisma/.prisma/client

  // TODO have a test for this? is is still needed?
  await Promise.all(
    Object.entries(fileMap).map(async ([fileName, file]) => {
      const filePath = path.join(finalOutputDir, fileName)
      // The deletion of the file is necessary, so VSCode
      // picks up the changes.
      if (await exists(filePath)) {
        await remove(filePath)
      }
      await writeFile(filePath, file)
    }),
  )
  const runtimeSourceDir = testMode
    ? eval(`require('path').join(__dirname, '../../runtime')`)
    : eval(`require('path').join(__dirname, '../runtime')`)

  // if users use a custom output dir
  if (copyRuntime || !path.resolve(outputDir).endsWith(`@prisma${path.sep}client`)) {
    // TODO: Windows, / is not working here...
    const copyTarget = path.join(outputDir, 'runtime')
    await makeDir(copyTarget)
    if (runtimeSourceDir !== copyTarget) {
      await copy({
        from: runtimeSourceDir,
        to: copyTarget,
        recursive: true,
        parallelJobs: process.platform === 'win32' ? 1 : 20,
        overwrite: true,
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

  // TODO rename this to become more explicit (skip engine copy)
  if (transpile === true && dataProxy !== true) {
    if (process.env.NETLIFY) {
      await makeDir('/tmp/prisma-engines')
    }

    for (const [binaryTarget, filePath] of Object.entries(enginePath)) {
      const fileName = path.basename(filePath)
      const target =
        process.env.NETLIFY && binaryTarget !== 'rhel-openssl-1.0.x' // TODO understand this one day
          ? path.join('/tmp/prisma-engines', fileName)
          : path.join(finalOutputDir, fileName)
      const [sourceFileSize, targetFileSize] = await Promise.all([fileSize(filePath), fileSize(target)])

      // If the target doesn't exist yet, copy it
      if (!targetFileSize) {
        if (fs.existsSync(filePath)) {
          await overwriteFile(filePath, target)
          continue
        } else {
          throw new Error(`File at ${filePath} is required but was not present`)
        }
      }

      // If target !== source size, they're definitely different, copy it
      if (targetFileSize && sourceFileSize && targetFileSize !== sourceFileSize) {
        await overwriteFile(filePath, target)
        continue
      }
      const binaryName =
        clientEngineType === ClientEngineType.Binary ? BinaryType.queryEngine : BinaryType.libqueryEngine
      // As they are of equal size now, let's check for the engine hash (/getVersion)
      const [sourceVersion, targetVersion] = await Promise.all([
        getEngineVersion(filePath, binaryName).catch(() => null),
        getEngineVersion(target, binaryName).catch(() => null),
      ])

      if (sourceVersion && targetVersion && sourceVersion === targetVersion) {
        // skip
      } else {
        await overwriteFile(filePath, target)
      }
    }
  }

  const schemaTargetPath = path.join(finalOutputDir, 'schema.prisma')
  if (schemaPath !== schemaTargetPath) {
    await copyFile(schemaPath, schemaTargetPath)
  }

  // TODO problem: investigate why we copy it again to the output dir
  const proxyIndexJsPath = path.join(outputDir, 'index.js')
  const proxyIndexBrowserJsPath = path.join(outputDir, 'index-browser.js')
  const proxyIndexDTSPath = path.join(outputDir, 'index.d.ts')
  if (!fs.existsSync(proxyIndexJsPath)) {
    await copyFile(path.join(__dirname, '../../index.js'), proxyIndexJsPath)
  }

  if (!fs.existsSync(proxyIndexDTSPath)) {
    await copyFile(path.join(__dirname, '../../index.d.ts'), proxyIndexDTSPath)
  }

  if (!fs.existsSync(proxyIndexBrowserJsPath)) {
    await copyFile(path.join(__dirname, '../../index-browser.js'), proxyIndexBrowserJsPath)
  }
}

async function fileSize(name: string): Promise<number | null> {
  try {
    const statResult = await stat(name)
    return statResult.size
  } catch (e) {
    return null
  }
}

function validateDmmfAgainstDenylists(prismaClientDmmf: PrismaClientDMMF.Document): Error[] | null {
  const errorArray = [] as Error[]

  const denylists = {
    // A copy of this list is also in prisma-engines. Any edit should be done in both places.
    // https://github.com/prisma/prisma-engines/blob/main/libs/datamodel/core/src/transform/ast_to_dml/reserved_model_names.rs
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
    content = await fs.promises.readFile(path.join(directory, 'package.json'), 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') {
      // no package.json exists, we are good
      return
    }
    throw e
  }
  const { name } = JSON.parse(content)
  if (name === clientPackageName) {
    const message = [`Generating client into ${chalk.bold(directory)} is not allowed.`]
    message.push('This package is used by `prisma generate` and overwriting its content is dangerous.')
    message.push('')
    message.push('Suggestion:')
    const outputDeclaration = findOutputPathDeclaration(datamodel)

    if (outputDeclaration && outputDeclaration.content.includes(clientPackageName)) {
      const outputLine = outputDeclaration.content
      message.push(`In ${chalk.bold(schemaPath)} replace:`)
      message.push('')
      message.push(
        `${chalk.dim(outputDeclaration.lineNumber)} ${replacePackageName(outputLine, chalk.red(clientPackageName))}`,
      )
      message.push('with')

      message.push(
        `${chalk.dim(outputDeclaration.lineNumber)} ${replacePackageName(outputLine, chalk.green('.prisma/client'))}`,
      )
    } else {
      message.push(
        `Generate client into ${chalk.bold(replacePackageName(directory, chalk.green('.prisma/client')))} instead`,
      )
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
