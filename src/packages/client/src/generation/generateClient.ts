import copy from '@apexearth/copy'
import {
  BinaryPaths,
  DataSource,
  DMMF,
  GeneratorConfig,
} from '@prisma/generator-helper'
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
import pkgUp from 'pkg-up'

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

async function getDotPrismaDir(outputDir: string): Promise<string> {
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
  const useDotPrisma = testMode ? !runtimePath : !generator?.isCustomOutput

  runtimePath =
    runtimePath || (useDotPrisma ? '@prisma/client/runtime' : './runtime')

  const finalOutputDir = useDotPrisma
    ? await getDotPrismaDir(outputDir)
    : outputDir

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

  const denylistsErrors = validateDmmfAgainstDenylists(
    prismaClientDmmf,
    generator?.previewFeatures,
  )

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
      const [sourceFileSize, targetFileSize] = await Promise.all([
        fileSize(filePath),
        fileSize(target),
      ])

      // If the target doesn't exist yet, copy it
      if (!targetFileSize) {
        await copyFile(filePath, target)
        continue
      }

      // If target !== source size, they're definitely different, copy it
      if (
        targetFileSize &&
        sourceFileSize &&
        targetFileSize !== sourceFileSize
      ) {
        await copyFile(filePath, target)
        continue
      }

      // They must have an equal size now, let's check for the hash
      const [sourceVersion, targetVersion] = await Promise.all([
        getVersion(filePath).catch(() => null),
        getVersion(target).catch(() => null),
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
    if (finalOutputDir !== backupPath && !generator?.isCustomOutput) {
      await copy({
        from: finalOutputDir,
        to: backupPath,
        recursive: true,
        parallelJobs: process.platform === 'win32' ? 1 : 20,
        overwrite: true,
      })
    }
  }

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

const backup = `/// <reference types="node" />

export { DMMF } from './dmmf-types'
import { inspect } from "util";
export declare type Value = string | number | boolean | object | null | undefined;
export declare type RawValue = Value | Sql;

/**
 * A SQL instance can be nested within each other to build SQL strings.
 */
export declare class Sql {
    values: Value[];
    strings: string[];
    rawStrings: ReadonlyArray<string>;
    rawValues: ReadonlyArray<RawValue>;
    constructor(rawStrings: ReadonlyArray<string>, rawValues: ReadonlyArray<RawValue>);
    readonly text: string;
    readonly sql: string;
    [inspect.custom](): {
        text: string;
        sql: string;
        values: Value[];
    };
}
/**
 * Create a SQL query for a list of values.
 */
export declare function join(values: RawValue[], separator?: string): Sql;
/**
 * Create raw SQL statement.
 */
export declare function raw(value: string): Sql;
/**
 * Placeholder value for "no text".
 */
export declare const empty: Sql;
/**
 * Create a SQL object from a template string.
 */
export declare function sqltag(strings: TemplateStringsArray, ...values: RawValue[]): Sql;
/**
 * Standard \`sql\` tag.
 */


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

function validateDmmfAgainstDenylists(
  prismaClientDmmf: PrismaClientDMMF.Document,
  previewFeatures: string[] = [],
): Error[] | null {
  const errorArray = [] as Error[]

  const denylists = {
    // A copy of this list is also in prisma-engines. Any edit should be done in both places.
    // https://github.com/prisma/prisma-engines/blob/master/libs/datamodel/core/src/transform/ast_to_dml/reserved_model_names.rs
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
  if (previewFeatures.includes('tranactionApi')) {
    denylists.models.push('transaction')
    denylists.models.push('Transaction')
  }

  for (const { name } of prismaClientDmmf.datamodel.models) {
    denylists.dynamic.push(
      ...[
        `${name}Select`,
        `${name}Include`,
        `${name}Default`,
        `${name}Delegate`,
        `${name}GetPayload`,
        `${name}Filter`,

        `${name}Args`,
        `${name}ArgsFilter`,
        `${name}ArgsRequired`,

        `${name}WhereInput`,
        `${name}WhereUniqueInput`,
        `${name}CreateInput`,
        `${name}UpdateInput`,
        `${name}UpdateManyMutationInput`,
        `${name}OrderByInput`,

        `${name}CreateArgs`,

        `${name}UpsertArgs`,

        `${name}UpdateArgs`,
        `${name}UpdateManyArgs`,

        `${name}DeleteArgs`,
        `${name}DeleteManyArgs`,
        `Extract${name}SelectDeleteArgs`,
        `Extract${name}IncludeDeleteArgs`,

        `FindOne${name}Args`,

        `FindMany${name}Args`,

        /** Aggregate Types */

        `Aggregate${name}`,
        `${name}AvgAggregateOutputType`,
        `${name}SumAggregateOutputType`,
        `${name}MinAggregateOutputType`,
        `${name}MaxAggregateOutputType`,
        `${name}AvgAggregateInputType`,
        `${name}SumAggregateInputType`,
        `${name}MinAggregateInputType`,
        `${name}MaxAggregateInputType`,
        `Aggregate${name}Args`,
        `Get${name}AggregateType`,
        `Get${name}AggregateScalarType`,
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
        denylists.fields.includes(it.name) ||
        denylists.dynamic.includes(it.name)
      ) {
        errorArray.push(Error(`"model ${it.name}"`))
      }
    }
  }

  return errorArray.length > 0 ? errorArray : null
}
