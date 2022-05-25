import { BinaryType } from '@prisma/fetch-engine'
import type { BinaryPaths, DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper'
import type { Platform } from '@prisma/sdk'
import { ClientEngineType, getClientEngineType, getVersion } from '@prisma/sdk'
import copy from '@timsuchanek/copy'
import chalk from 'chalk'
import fs from 'fs'
import makeDir from 'make-dir'
import path from 'path'
import pkgUp from 'pkg-up'
import { promisify } from 'util'

import type { DMMF as PrismaClientDMMF } from '../runtime/dmmf-types'
import type { Dictionary } from '../runtime/utils/common'
import { getPrismaClientDMMF } from './getDMMF'
import { JS, TS, TSClient } from './TSClient'
import { BrowserJS } from './TSClient/Generatable'

const remove = promisify(fs.unlink)
const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)
const copyFile = promisify(fs.copyFile)
const stat = promisify(fs.stat)

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
  datamodelPath: string
  schemaDir?: string
  transpile?: boolean
  runtimeDir?: string
  runtimeName?: string
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
  schemaDir = process.cwd(),
  runtimeDir = '@prisma/client/runtime',
  runtimeName = 'index',
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
}: GenerateClientOptions): Promise<BuildClientResult> {
  const document = getPrismaClientDMMF(dmmf)
  const clientEngineType = getClientEngineType(generator!)

  const client = new TSClient({
    document,
    runtimeDir,
    runtimeName,
    datasources: datasources,
    generator,
    platforms:
      clientEngineType === ClientEngineType.Library
        ? (Object.keys(binaryPaths.libqueryEngine!) as Platform[])
        : (Object.keys(binaryPaths.queryEngine!) as Platform[]),
    schemaDir,
    outputDir,
    clientVersion,
    engineVersion,
    projectRoot: projectRoot!,
    activeProvider,
    dataProxy,
  })

  const fileMap = {
    'index.d.ts': await TS(client),
    'index.js': await JS(client),
    'index-browser.js': await BrowserJS(client),
  }

  return {
    fileMap,
    prismaClientDmmf: document,
  }
}

// TODO: explore why we have a special case for excluding pnpm
async function getDotPrismaDir(outputDir: string): Promise<string> {
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

export async function generateClient({
  datamodel,
  datamodelPath,
  schemaDir = datamodelPath ? path.dirname(datamodelPath) : process.cwd(),
  outputDir,
  transpile,
  runtimeDir,
  runtimeName,
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
}: GenerateClientOptions): Promise<void> {
  const useDotPrisma = testMode ? !runtimeDir : !generator?.isCustomOutput
  const clientEngineType = getClientEngineType(generator!)
  runtimeDir = runtimeDir || (useDotPrisma ? '@prisma/client/runtime' : './runtime')

  // we make sure that we point to the right engine build
  if (dataProxy === true) {
    runtimeName = 'proxy' // TODO: decouple the runtimes
  }

  const finalOutputDir = useDotPrisma ? await getDotPrismaDir(outputDir) : outputDir

  const packageRoot = await pkgUp({ cwd: path.dirname(finalOutputDir) })
  const projectRoot = packageRoot ? path.dirname(packageRoot) : process.cwd()

  const { prismaClientDmmf, fileMap } = await buildClient({
    datamodel,
    datamodelPath,
    schemaDir,
    transpile,
    runtimeDir: runtimeDir,
    runtimeName,
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

  const denylistsErrors = validateDmmfAgainstDenylists(prismaClientDmmf)

  if (denylistsErrors) {
    let message = `${chalk.redBright.bold(
      'Error: ',
    )}The schema at "${datamodelPath}" contains reserved keywords.\n       Rename the following items:`

    for (const error of denylistsErrors) {
      message += '\n         - ' + error.message
    }

    message += `\nTo learn more about how to rename models, check out https://pris.ly/d/naming-models`

    throw new DenylistError(message)
  }

  await makeDir(finalOutputDir)
  await makeDir(path.join(outputDir, 'runtime'))

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

  if (transpile === true && dataProxy === false) {
    if (process.env.NETLIFY) {
      await makeDir('/tmp/prisma-engines')
    }

    for (const [binaryTarget, filePath] of Object.entries(enginePath)) {
      const fileName = path.basename(filePath)
      const target =
        process.env.NETLIFY && binaryTarget !== 'rhel-openssl-1.0.x'
          ? path.join('/tmp/prisma-engines', fileName)
          : path.join(finalOutputDir, fileName)
      const [sourceFileSize, targetFileSize] = await Promise.all([fileSize(filePath), fileSize(target)])

      // If the target doesn't exist yet, copy it
      if (!targetFileSize) {
        if (fs.existsSync(filePath)) {
          await copyFile(filePath, target)
          continue
        } else {
          throw new Error(`File at ${filePath} is required but was not present`)
        }
      }

      // If target !== source size, they're definitely different, copy it
      if (targetFileSize && sourceFileSize && targetFileSize !== sourceFileSize) {
        await copyFile(filePath, target)
        continue
      }
      const binaryName =
        clientEngineType === ClientEngineType.Binary ? BinaryType.queryEngine : BinaryType.libqueryEngine
      // They must have an equal size now, let's check for the hash
      const [sourceVersion, targetVersion] = await Promise.all([
        getVersion(filePath, binaryName).catch(() => null),
        getVersion(target, binaryName).catch(() => null),
      ])

      if (sourceVersion && targetVersion && sourceVersion === targetVersion) {
        // skip
      } else {
        await copyFile(filePath, target)
      }
    }
  }

  const datamodelTargetPath = path.join(finalOutputDir, 'schema.prisma')
  if (datamodelPath !== datamodelTargetPath) {
    await copyFile(datamodelPath, datamodelTargetPath)
  }

  const packageJsonTargetPath = path.join(finalOutputDir, 'package.json')
  const pkgJson = JSON.stringify(
    {
      name: '.prisma/client',
      main: 'index.js',
      types: 'index.d.ts',
      browser: 'index-browser.js',
    },
    null,
    2,
  )
  await writeFile(packageJsonTargetPath, pkgJson)

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
