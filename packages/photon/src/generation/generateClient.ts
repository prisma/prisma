import copy from '@apexearth/copy'
import {
  BinaryPaths,
  DataSource,
  DMMF,
  GeneratorConfig,
} from '@prisma/generator-helper'
import Debug from 'debug'
import fs from 'fs'
import makeDir from 'make-dir'
import path from 'path'
import hasha from 'hasha'
import { promisify } from 'util'
import { DMMF as PrismaClientDMMF } from '../runtime/dmmf-types'
import { Dictionary } from '../runtime/utils/common'
import { getPrismaClientDMMF } from '../runtime/getDMMF'
import { resolveDatasources } from '../utils/resolveDatasources'
import { extractSqliteSources } from './extractSqliteSources'
import { TSClient, TS, JS } from './TSClient'

const debug = Debug('generateClient')
debug.log = console.log.bind(console)

const remove = promisify(fs.unlink)
const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)
const copyFile = promisify(fs.copyFile)
const stat = promisify(fs.stat)

export interface GenerateClientOptions {
  datamodel: string
  datamodelPath: string
  browser?: boolean
  schemaDir?: string
  transpile?: boolean
  runtimePath?: string
  outputDir: string
  version?: string
  generator?: GeneratorConfig
  dmmf: DMMF.Document
  datasources: DataSource[]
  binaryPaths: BinaryPaths
  testMode?: boolean
  copyRuntime?: boolean
}

export interface BuildClientResult {
  fileMap: Dictionary<string>
  prismaClientDmmf: PrismaClientDMMF.Document
}

export async function buildClient({
  datamodel,
  schemaDir = process.cwd(),
  transpile = false,
  runtimePath = './runtime',
  browser = false,
  binaryPaths,
  outputDir,
  generator,
  version,
  dmmf,
  datasources,
}: GenerateClientOptions): Promise<BuildClientResult> {
  const document = getPrismaClientDMMF(dmmf)

  const client = new TSClient({
    document,
    runtimePath,
    browser,
    datasources: resolveDatasources(datasources, schemaDir, outputDir),
    sqliteDatasourceOverrides: extractSqliteSources(
      datamodel,
      schemaDir,
      outputDir,
    ),
    generator,
    platforms: Object.keys(binaryPaths.queryEngine!),
    version,
    schemaDir,
    outputDir,
  })

  const fileMap = {
    'index.d.ts': TS(client),
    'index.js': JS(client),
  }

  return {
    fileMap,
    prismaClientDmmf: document,
  }
}

export async function generateClient({
  datamodel,
  datamodelPath,
  schemaDir = datamodelPath ? path.dirname(datamodelPath) : process.cwd(),
  outputDir,
  transpile,
  runtimePath,
  browser,
  version = 'latest',
  generator,
  dmmf,
  datasources,
  binaryPaths,
  testMode,
  copyRuntime,
}: GenerateClientOptions): Promise<BuildClientResult | undefined> {
  runtimePath = runtimePath || './runtime'
  const { prismaClientDmmf, fileMap } = await buildClient({
    datamodel,
    datamodelPath,
    schemaDir,
    transpile,
    runtimePath,
    browser,
    outputDir,
    generator,
    version,
    dmmf,
    datasources,
    binaryPaths,
  })

  debug(`makeDir: ${outputDir}`)
  await makeDir(path.join(outputDir, 'runtime'))
  await Promise.all(
    Object.entries(fileMap).map(async ([fileName, file]) => {
      const filePath = path.join(outputDir, fileName)
      // The deletion of the file is necessary, so VSCode
      // picks up the changes.
      if (await exists(filePath)) {
        await remove(filePath)
      }
      await writeFile(filePath, file)
    }),
  )
  const inputDir = testMode
    ? eval(`require('path').join(__dirname, '../../runtime')`) // tslint:disable-line
    : eval(`require('path').join(__dirname, '../runtime')`) // tslint:disable-line

  // if users use a custom output dir
  if (
    copyRuntime ||
    !path.resolve(outputDir).endsWith(`@prisma${path.sep}client`)
  ) {
    // TODO: Windows, / is not working here...
    const copyTarget = path.join(outputDir, '/runtime')
    debug({ copyRuntime, outputDir, copyTarget, inputDir })
    if (inputDir !== copyTarget) {
      await copy({
        from: inputDir,
        to: copyTarget,
        recursive: true,
        parallelJobs: process.platform === 'win32' ? 1 : 20,
        overwrite: true,
      })
    }
  }

  if (!binaryPaths.queryEngine) {
    throw new Error(
      `Prisma Client needs \`queryEngine\` in the \`binaryPaths\` object.`,
    )
  }

  if (transpile) {
    for (const filePath of Object.values(binaryPaths.queryEngine)) {
      const fileName = path.basename(filePath)
      const target = path.join(outputDir, 'runtime', fileName)
      const before = Date.now()
      const [fileSizeA, fileSizeB] = await Promise.all([
        fileSize(filePath),
        fileSize(target),
      ])
      if (fileSizeA && fileSizeB && fileSizeA !== fileSizeB) {
        continue
      }
      const [hashA, hashB] = await Promise.all([
        hasha.fromFile(filePath, { algorithm: 'md5' }).catch(() => null),
        hasha.fromFile(target, { algorithm: 'md5' }).catch(() => null),
      ])
      const after = Date.now()
      if (hashA && hashB && hashA === hashB) {
        debug(`Getting hashes took ${after - before}ms`)
        debug(
          `Skipping ${filePath} to ${target} as both files have md5 hash ${hashA}`,
        )
      } else {
        debug(`Copying ${filePath} to ${target}`)
        await copyFile(filePath, target)
      }
    }
  }

  const datamodelTargetPath = path.join(outputDir, 'schema.prisma')
  if (datamodelPath !== datamodelTargetPath) {
    await copyFile(datamodelPath, datamodelTargetPath)
  }

  if (transpile) {
    await writeFile(path.join(outputDir, 'runtime/index.d.ts'), backup)
  }

  return { prismaClientDmmf, fileMap }
}

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

export declare var mergeBy: any
export declare type mergeBy = any

export declare var unpack: any
export declare type unpack = any

export declare var getDMMF: any
export declare type getDMMF = any

export declare var stripAnsi: any
export declare type stripAnsi = any

export declare var parseDotenv: any
export declare type parseDotenv = any
`

async function fileSize(name: string): Promise<number | null> {
  try {
    const statResult = await stat(name)
    return statResult.size
  } catch (e) {
    return null
  }
}
