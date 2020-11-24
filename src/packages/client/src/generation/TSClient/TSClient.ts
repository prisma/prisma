import { GeneratorConfig } from '@prisma/generator-helper'
import indent from 'indent-string'
import path from 'path'
import { DMMFClass } from '../../runtime/dmmf'
import { DMMF } from '../../runtime/dmmf-types'

import { InternalDatasource } from '../../runtime/utils/printDatasources'
import { DatasourceOverwrite } from './../extractSqliteSources'

import { GetPrismaClientOptions } from '../../runtime/getPrismaClient'
import { klona } from 'klona'
import { getEnvPaths } from '@prisma/sdk'
import { Generatable } from './Generatable'
import { escapeJson, ExportCollector } from './helpers'
import { Enum } from './Enum'
import { PrismaClientClass } from './PrismaClient'
import { Model } from './Model'
import { InputType } from './Input'
import { commonCodeJS, commonCodeTS } from './common'

export interface TSClientOptions {
  projectRoot: string
  clientVersion: string
  engineVersion: string
  document: DMMF.Document
  runtimePath: string
  browser?: boolean
  datasources: InternalDatasource[]
  generator?: GeneratorConfig
  platforms?: string[]
  sqliteDatasourceOverrides?: DatasourceOverwrite[]
  schemaDir: string
  outputDir: string
}

export class TSClient implements Generatable {
  protected readonly dmmf: DMMFClass
  protected readonly dmmfString: string
  constructor(protected readonly options: TSClientOptions) {
    this.dmmfString = escapeJson(JSON.stringify(options.document))
    this.dmmf = new DMMFClass(klona(options.document))
  }
  public toJS(): string {
    const {
      generator,
      sqliteDatasourceOverrides,
      outputDir,
      schemaDir,
    } = this.options
    const schemaPath = path.join(schemaDir, 'prisma.schema')
    const envPaths = getEnvPaths(schemaPath, { cwd: outputDir })
    const relativeEnvPaths = {
      rootEnvPath:
        envPaths.rootEnvPath && path.relative(outputDir, envPaths.rootEnvPath),
      schemaEnvPath:
        envPaths.schemaEnvPath &&
        path.relative(outputDir, envPaths.schemaEnvPath),
    }

    const config: Omit<GetPrismaClientOptions, 'document' | 'dirname'> = {
      generator,
      relativeEnvPaths,
      sqliteDatasourceOverrides,
      relativePath: path.relative(outputDir, schemaDir),
      clientVersion: this.options.clientVersion,
      engineVersion: this.options.engineVersion,
      datasourceNames: this.options.datasources.map((d) => d.name),
    }
    // used for the __dirname polyfill needed for Next.js
    const cwdDirname = path.relative(this.options.projectRoot, outputDir)

    const code = `${commonCodeJS(this.options)}

const dirnamePolyfill = path.join(process.cwd(), ${JSON.stringify(cwdDirname)})
const dirname = __dirname.length === 1 ? dirnamePolyfill : __dirname

/**
 * Enums
 */
// Based on
// https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275
function makeEnum(x) { return x; }

${this.dmmf.schema.enumTypes.prisma
  .map((type) => new Enum(type, true).toJS())
  .join('\n\n')}
${
  this.dmmf.schema.enumTypes.model
    ?.map((type) => new Enum(type, false).toJS())
    .join('\n\n') ?? ''
}

${new Enum(
  {
    name: 'ModelName',
    values: this.dmmf.mappings.modelOperations.map((m) => m.model),
  },
  true,
).toJS()}


/**
 * DMMF
 */
const dmmfString = ${JSON.stringify(this.dmmfString)}

// We are parsing 2 times, as we want independent objects, because
// DMMFClass introduces circular references in the dmmf object
const dmmf = JSON.parse(dmmfString)
exports.Prisma.dmmf = JSON.parse(dmmfString)

/**
 * Create the Client
 */

const config = ${JSON.stringify(config, null, 2)}
config.document = dmmf
config.dirname = dirname

/**
 * Only for env conflict warning
 * loading of env variable occurs in getPrismaClient
 */
const envPaths = {
  rootEnvPath: config.relativeEnvPaths.rootEnvPath && path.resolve(dirname, config.relativeEnvPaths.rootEnvPath),
  schemaEnvPath: config.relativeEnvPaths.schemaEnvPath && path.resolve(dirname, config.relativeEnvPaths.schemaEnvPath)
}
warnEnvConflicts(envPaths)

const PrismaClient = getPrismaClient(config)
exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)

/**
 * Build tool annotations
 * In order to make \`ncc\` and \`@vercel/nft\` happy.
 * The process.cwd() annotation is only needed for https://github.com/vercel/vercel/tree/master/packages/now-next
**/
${
  this.options.platforms
    ? this.options.platforms
        .map(
          (p) => `path.join(__dirname, 'query-engine-${p}');
path.join(process.cwd(), './${path.join(cwdDirname, `query-engine-${p}`)}');
`,
        )
        .join('\n')
    : ''
}
/**
 * Annotation for \`@vercel/nft\`
 * The process.cwd() annotation is only needed for https://github.com/vercel/vercel/tree/master/packages/now-next
**/
path.join(__dirname, 'schema.prisma');
path.join(process.cwd(), './${path.join(cwdDirname, `schema.prisma`)}');
`

    return code
  }
  public toTS(): string {
    const prismaClientClass = new PrismaClientClass(
      this.dmmf,
      this.options.datasources,
      this.options.outputDir,
      this.options.browser,
      this.options.generator,
      this.options.sqliteDatasourceOverrides,
      this.options.schemaDir,
    )

    const collector = new ExportCollector()

    const commonCode = commonCodeTS(this.options)
    const models = Object.values(this.dmmf.modelMap).map(
      (model) =>
        new Model(model, this.dmmf, this.options.generator!, collector),
    )

    // TODO: Make this code more efficient and directly return 2 arrays

    const prismaEnums = this.dmmf.schema.enumTypes.prisma.map((type) =>
      new Enum(type, true, collector).toTS(),
    )

    const modelEnums = this.dmmf.schema.enumTypes.model?.map((type) =>
      new Enum(type, false, collector).toTS(),
    )

    let code = `
/**
 * Client
**/

${commonCode.tsWithoutNamespace()}

${models.map((m) => m.toTSWithoutNamespace()).join('\n')}
${
  modelEnums && modelEnums.length > 0
    ? `
/**
 * Enums
 */

// Based on
// https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275

${modelEnums.join('\n\n')}
`
    : ''
}
${prismaClientClass.toTSWithoutNamespace()}

export namespace Prisma {
${indent(
  `${commonCode.ts()}
${new Enum(
  {
    name: 'ModelName',
    values: this.dmmf.mappings.modelOperations.map((m) => m.model),
  },
  true,
  collector,
).toTS()}

${prismaClientClass.toTS()}
export type Datasource = {
  url?: string
}

${models.map((model) => model.toTS()).join('\n')}

/**
 * Enums
 */

// Based on
// https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275

${prismaEnums.join('\n\n')}

/**
 * Deep Input Types
 */

${this.dmmf.inputObjectTypes.prisma
  .map((inputType) => new InputType(inputType, collector).toTS())
  .join('\n')}

${
  this.dmmf.inputObjectTypes.model
    ?.map((inputType) => new InputType(inputType, collector).toTS())
    .join('\n') ?? ''
}

/**
 * Batch Payload for updateMany & deleteMany
 */

export type BatchPayload = {
  count: number
}

/**
 * DMMF
 */
export const dmmf: runtime.DMMF.Document;
`,
  2,
)}}`

    const symbols = collector.getSymbols()

    code +=
      `\n
/*
* Exports for compatiblity introduced in 2.12.0
* Please import from the Prisma namespace instead
*/
` +
      symbols
        .map(
          (s) => `
/**
 * @deprecated Renamed to \`Prisma.${s}\`
 */
export import ${s} = Prisma.${s}`,
        )
        .join('\n')

    return code
  }
}
