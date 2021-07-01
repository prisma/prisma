import { GeneratorConfig } from '@prisma/generator-helper'
import { Platform } from '@prisma/get-platform'
import { getEnvPaths } from '@prisma/sdk/dist/utils/getEnvPaths'
import indent from 'indent-string'
import { klona } from 'klona'
import path from 'path'
import { DMMFClass } from '../../runtime/dmmf'
import { DMMF } from '../../runtime/dmmf-types'
import { GetPrismaClientOptions } from '../../runtime/getPrismaClient'
import { InternalDatasource } from '../../runtime/utils/printDatasources'
import { buildNFTEngineAnnotations } from '../utils'
import { DatasourceOverwrite } from './../extractSqliteSources'
import { commonCodeJS, commonCodeTS } from './common'
import { Count } from './Count'
import { Enum } from './Enum'
import { Generatable } from './Generatable'
import { escapeJson, ExportCollector } from './helpers'
import { InputType } from './Input'
import { Model } from './Model'
import { PrismaClientClass } from './PrismaClient'

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
  activeProvider: string
}

export class TSClient implements Generatable {
  protected readonly dmmf: DMMFClass
  protected readonly dmmfString: string
  constructor(protected readonly options: TSClientOptions) {
    this.dmmfString = escapeJson(JSON.stringify(options.document))
    this.dmmf = new DMMFClass(klona(options.document))
  }
  public toJS(): string {
    const { generator, sqliteDatasourceOverrides, outputDir, schemaDir } =
      this.options
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
      activeProvider: this.options.activeProvider,
    }

    // Node-API env var
    if (
      process.env.PRISMA_FORCE_NAPI &&
      !config.generator?.previewFeatures.includes('nApi')
    ) {
      config.generator?.previewFeatures.push('nApi')
    }

    // get relative output dir for it to be preserved even after bundling, or
    // being moved around as long as we keep the same project dir structure.
    const relativeOutputDir = path.relative(process.cwd(), outputDir)

    // on serverless envs, relative output dir can be one step lower because of
    // where and how the code is packaged into the lambda like with a build step
    // with platforms like Vercel or Netlify. We want to check this as well.
    const slsRelativeOutputDir = path
      .relative(process.cwd(), outputDir)
      .split(path.sep)
      .slice(1)
      .join(path.sep)

    const code = `${commonCodeJS({ ...this.options, browser: false })}

// folder where the generated client is found
const dirname = findSync(process.cwd(), [
  '${JSON.stringify(relativeOutputDir)}',
  '${JSON.stringify(slsRelativeOutputDir)}',
], ['d'], ['d'], 1)[0] || __dirname

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
${buildNFTEngineAnnotations(
  this.options.generator?.previewFeatures?.includes('nApi') ?? false,
  this.options.platforms as Platform[],
  relativeOutputDir,
)}
/**
 * Annotation for \`@vercel/nft\`
 * The process.cwd() annotation is only needed for https://github.com/vercel/vercel/tree/master/packages/now-next
**/
path.join(__dirname, 'schema.prisma');
path.join(process.cwd(), './${path.join(relativeOutputDir, `schema.prisma`)}');
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
    const models = Object.values(this.dmmf.modelMap).reduce((acc, model) => {
      if (this.dmmf.outputTypeMap[model.name]) {
        acc.push(new Model(model, this.dmmf, this.options.generator, collector))
      }
      return acc
    }, [] as Model[])

    // TODO: Make this code more efficient and directly return 2 arrays

    const prismaEnums = this.dmmf.schema.enumTypes.prisma.map((type) =>
      new Enum(type, true, collector).toTS(),
    )

    const modelEnums = this.dmmf.schema.enumTypes.model?.map((type) =>
      new Enum(type, false, collector).toTS(),
    )

    const countTypes: Count[] = this.dmmf.schema.outputObjectTypes.prisma
      .filter((t) => t.name.endsWith('CountOutputType'))
      .map((t) => new Count(t, this.dmmf, this.options.generator, collector))

    const code = `
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

/**
 * Count Types
 */

${countTypes.map((t) => t.toTS()).join('\n')}

/**
 * Models
 */
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
  .reduce((acc, inputType) => {
    if (inputType.name.includes('Json') && inputType.name.includes('Filter')) {
      // This generates types for JsonFilter to prevent the usage of 'path' without another parameter
      const baseName = `Required<${inputType.name}Base>`
      acc.push(`export type ${inputType.name} = 
  | PatchUndefined<
      Either<${baseName}, Exclude<keyof ${baseName}, 'path'>>,
      ${baseName}
    >
  | OptionalFlat<Omit<${baseName}, 'path'>>`)
      collector?.addSymbol(inputType.name)
      acc.push(
        new InputType(
          { ...inputType, name: `${inputType.name}Base` },
          collector,
        ).toTS(),
      )
    } else {
      acc.push(new InputType(inputType, collector).toTS())
    }
    return acc
  }, [] as string[])
  .join('\n')}

${
  this.dmmf.inputObjectTypes.model
    ?.map((inputType) => new InputType(inputType, collector).toTS())
    .join('\n') ?? ''
}

/**
 * Batch Payload for updateMany & deleteMany & createMany
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

    return code
  }

  public toBrowserJS(): string {
    const code = `${commonCodeJS({ ...this.options, browser: true })}
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
 * Create the Client
 */
class PrismaClient {
  constructor() {
    throw new Error(
      \`PrismaClient is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues\`,
    )
  }
}
exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
`
    return code
  }
}
