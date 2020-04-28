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
import chalk from 'chalk'
import { promisify } from 'util'
import { DMMF as PrismaClientDMMF } from '../runtime/dmmf-types'
import { Dictionary } from '../runtime/utils/common'
import { getPrismaClientDMMF } from './getDMMF'
import { resolveDatasources } from '../utils/resolveDatasources'
import { extractSqliteSources } from './extractSqliteSources'
import { TSClient, TS, JS } from './TSClient'
import { getVersion } from '@prisma/sdk/dist/engineCommands'

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
  generator?: GeneratorConfig
  dmmf: DMMF.Document
  datasources: DataSource[]
  binaryPaths: BinaryPaths
  testMode?: boolean
  copyRuntime?: boolean
  engineVersion: string
  clientVersion: string
}

export interface BuildClientResult {
  fileMap: Dictionary<string>
  prismaClientDmmf: PrismaClientDMMF.Document
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function buildClient({
  datamodel,
  schemaDir = process.cwd(),
  runtimePath = '@prisma/client/runtime',
  browser = false,
  binaryPaths,
  outputDir,
  generator,
  dmmf,
  datasources,
  engineVersion,
  clientVersion,
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
    schemaDir,
    outputDir,
    clientVersion,
    engineVersion,
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

function getDotPrismaDir(outputDir: string): string {
  if (
    process.env.INIT_CWD &&
    process.env.npm_lifecycle_event === 'postinstall' &&
    !process.env.PWD?.includes('.pnpm')
  ) {
    return path.join(process.env.INIT_CWD, 'node_modules/.prisma/client')
  }

  return path.join(outputDir, '../../.prisma/client')
}

export async function generateClient({
  datamodel,
  datamodelPath,
  schemaDir = datamodelPath ? path.dirname(datamodelPath) : process.cwd(),
  outputDir,
  transpile,
  runtimePath,
  browser,
  generator,
  dmmf,
  datasources,
  binaryPaths,
  testMode,
  copyRuntime,
  clientVersion,
  engineVersion,
}: GenerateClientOptions): Promise<BuildClientResult | undefined> {
  const useDotPrisma = !generator?.isCustomOutput || testMode

  runtimePath =
    runtimePath || (useDotPrisma ? '@prisma/client/runtime' : './runtime')

  const finalOutputDir = useDotPrisma ? getDotPrismaDir(outputDir) : outputDir
  debug({ useDotPrisma, outputDir, finalOutputDir })

  const { prismaClientDmmf, fileMap } = await buildClient({
    datamodel,
    datamodelPath,
    schemaDir,
    transpile,
    runtimePath,
    browser,
    outputDir: finalOutputDir,
    generator,
    dmmf,
    datasources,
    binaryPaths,
    clientVersion,
    engineVersion,
  })

  const denylistsErrors = validateDmmfAgainstDenylists(prismaClientDmmf)
  if (denylistsErrors) {
    console.error(
      `${chalk.redBright.bold(
        'Error: ',
      )}The schema at "${datamodelPath}" contains reserved keywords.\n       Rename the following items:`,
    )
    for (const error of denylistsErrors) {
      console.error('         - ' + error.message)
    }
    process.exit(1)
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
    ? eval(`require('path').join(__dirname, '../../runtime')`) // tslint:disable-line
    : eval(`require('path').join(__dirname, '../runtime')`) // tslint:disable-line

  // if users use a custom output dir
  if (
    copyRuntime ||
    !path.resolve(outputDir).endsWith(`@prisma${path.sep}client`)
  ) {
    // TODO: Windows, / is not working here...
    const copyTarget = path.join(outputDir, 'runtime')
    await makeDir(copyTarget)
    debug({ copyRuntime, outputDir, copyTarget, runtimeSourceDir })
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

  if (!binaryPaths.queryEngine) {
    throw new Error(
      `Prisma Client needs \`queryEngine\` in the \`binaryPaths\` object.`,
    )
  }

  if (transpile) {
    for (const filePath of Object.values(binaryPaths.queryEngine)) {
      const fileName = path.basename(filePath)
      const target = path.join(finalOutputDir, fileName)
      const before = Date.now()
      const [sourceFileSize, targetFileSize] = await Promise.all([
        fileSize(filePath),
        fileSize(target),
      ])

      // If the target doesn't exist yet, copy it
      if (!targetFileSize) {
        debug(`Copying ${filePath} to ${target}`)
        await copyFile(filePath, target)
        continue
      }

      // If target !== source size, they're definitely different, copy it
      if (
        targetFileSize &&
        sourceFileSize &&
        targetFileSize !== sourceFileSize
      ) {
        debug(`Copying ${filePath} to ${target}`)
        await copyFile(filePath, target)
        continue
      }

      // They must have an equal size now, let's check for the hash
      const [sourceVersion, targetVersion] = await Promise.all([
        getVersion(filePath).catch(() => null),
        getVersion(target).catch(() => null),
      ])

      const after = Date.now()
      if (sourceVersion && targetVersion && sourceVersion === targetVersion) {
        debug(`Getting hashes took ${after - before}ms`)
        debug(
          `Skipping ${filePath} to ${target} as both files have md5 hash ${sourceVersion}`,
        )
      } else {
        debug(`Copying ${filePath} to ${target}`)
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
    },
    null,
    2,
  )
  await writeFile(packageJsonTargetPath, pkgJson)

  if (process.env.INIT_CWD) {
    const backupPath = path.join(
      process.env.INIT_CWD,
      'node_modules/.prisma/client',
    )
    debug({ finalOutputDir, backupPath })
    if (finalOutputDir !== backupPath) {
      await copy({
        from: finalOutputDir,
        to: backupPath,
        recursive: true,
        parallelJobs: process.platform === 'win32' ? 1 : 20,
        overwrite: true,
      })
    }
  }
  // }

  if (transpile) {
    await writeFile(path.join(outputDir, 'runtime/index.d.ts'), backup)
  }

  const proxyIndexJsPath = path.join(outputDir, 'index.js')
  const proxyIndexDTSPath = path.join(outputDir, 'index.d.ts')
  if (!fs.existsSync(proxyIndexJsPath)) {
    await copyFile(path.join(__dirname, '../../index.js'), proxyIndexJsPath)
  }

  if (!fs.existsSync(proxyIndexDTSPath)) {
    await copyFile(path.join(__dirname, '../../index.d.ts'), proxyIndexDTSPath)
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

export declare var sqlTemplateTag: any
export declare type sqlTemplateTag = any

export declare class PrismaClientKnownRequestError extends Error {
  code: string;
  meta?: object;
  constructor(message: string, code: string, meta?: any);
}

export declare class PrismaClientUnknownRequestError extends Error {
  constructor(message: string);
}

export declare class PrismaClientRustPanicError extends Error {
    constructor(message: string);
}

export declare class PrismaClientInitializationError extends Error {
    constructor(message: string);
}

export declare class PrismaClientValidationError extends Error {
    constructor(message: string);
}
`

async function fileSize(name: string): Promise<number | null> {
  try {
    const statResult = await stat(name)
    return statResult.size
  } catch (e) {
    return null
  }
}

function validateDmmfAgainstDenylists(prismaClientDmmf): Error[] | null {
  const errorArray = [] as Error[]

  const denylists = {
    models: [
      'dmmf',
      'PromiseType',
      'PromiseReturnType',
      'Enumerable',
      'MergeTruthyValues',
      'CleanupNever',
      'Subset',
      'AtLeastOne',
      'atMostOne',
      'OnlyOne',
      'StringFilter',
      'IDFilter',
      'FloatFilter',
      'IntFilter',
      'BooleanFilter',
      'DateTimeFilter',
      'NullableStringFilter',
      'NullableIDFilter',
      'NullableFloatFilter',
      'NullableIntFilter',
      'NullableBooleanFilter',
      'NullableDateTimeFilter',
      'PrismaClientFetcher',
      'PrismaClient',
      'Engine',
      'BatchPayload',
      'Datasources',
      'ErrorFormat',
      'Hooks',
      'LogLevel',
      'LogDefinition',
      'GetLogType',
      'GetEvents',
      'QueryEvent',
      'LogEvent',
      'ModelDelegate',
      'QueryDelegate',
      'missingArg',
      'ArgError',
      'InvalidFieldError',
      'InvalidFieldNameError',
      'InvalidFieldTypeError',
      'EmptySelectError',
      'NoTrueSelectError',
      'IncludeAndSelectError',
      'EmptyIncludeError',
      'InvalidArgError',
      'InvalidArgNameError',
      'MissingArgError',
      'InvalidArgTypeError',
      'AtLeastOneError',
      'AtMostOneError',
      'PrismaClientRequestError',
      'PrismaClientOptions',
      'PrismaClientKnownRequestError',
      'PrismaClientUnknownRequestError',
      'PrismaClientInitializationError',
      'PrismaClientRustPanicError',
      'PrismaVersion',
      // JavaScript keywords
      'await',
      'async',
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
    dynamic: [] as string[],
  }

  for (const m of prismaClientDmmf.datamodel.models) {
    denylists.dynamic.push(
      ...[
        `${m.name}Select`,
        `${m.name}Include`,
        `${m.name}Default`,
        `${m.name}Client`,
        `${m.name}Delegate`,
        `${m.name}GetPayload`,
        `${m.name}Filter`,

        `${m.name}Args`,
        `${m.name}ArgsFilter`,
        `${m.name}ArgsRequired`,

        `${m.name}WhereInput`,
        `${m.name}WhereUniqueInput`,
        `${m.name}CreateInput`,
        `${m.name}UpdateInput`,
        `${m.name}UpdateManyMutationInput`,
        `${m.name}OrderByInput`,

        `${m.name}CreateArgs`,

        `${m.name}UpsertArgs`,

        `${m.name}UpdateArgs`,
        `${m.name}UpdateManyArgs`,

        `${m.name}DeleteArgs`,
        `${m.name}DeleteManyArgs`,
        `Extract${m.name}SelectDeleteArgs`,
        `Extract${m.name}IncludeDeleteArgs`,

        `FindOne${m.name}Args`,

        `FindMany${m.name}Args`,
      ],
    )
  }

  if (prismaClientDmmf.datamodel.enums) {
    for (const it of prismaClientDmmf.datamodel.enums) {
      if (
        denylists.models.includes(it.name) ||
        denylists.fields.includes(it.name) ||
        denylists.dynamic.includes(it.name)
      ) {
        errorArray.push(Error(`"enum ${it.name}"`))
      }
    }
  }

  if (prismaClientDmmf.datamodel.models) {
    for (const it of prismaClientDmmf.datamodel.models) {
      if (
        denylists.models.includes(it.name) ||
        denylists.fields.includes(it.name)
      ) {
        errorArray.push(Error(`"model ${it.name}"`))
      }
    }
  }

  return errorArray.length > 0 ? errorArray : null
}
