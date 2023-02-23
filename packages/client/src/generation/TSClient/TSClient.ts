import type { GeneratorConfig } from '@prisma/generator-helper'
import type { Platform } from '@prisma/get-platform'
import { getClientEngineType, getEnvPaths } from '@prisma/internals'
import indent from 'indent-string'
import { klona } from 'klona'
import path from 'path'

import { DMMFHelper } from '../../runtime/dmmf'
import type { DMMF } from '../../runtime/dmmf-types'
import type { GetPrismaClientConfig } from '../../runtime/getPrismaClient'
import type { InternalDatasource } from '../../runtime/utils/printDatasources'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import { buildDebugInitialization } from '../utils/buildDebugInitialization'
import { buildDirname } from '../utils/buildDirname'
import { buildDMMF } from '../utils/buildDMMF'
import { buildInjectableEdgeEnv } from '../utils/buildInjectableEdgeEnv'
import { buildInlineDatasource } from '../utils/buildInlineDatasources'
import { buildInlineSchema } from '../utils/buildInlineSchema'
import { buildNFTAnnotations } from '../utils/buildNFTAnnotations'
import { buildRequirePath } from '../utils/buildRequirePath'
import { buildWarnEnvConflicts } from '../utils/buildWarnEnvConflicts'
import type { DatasourceOverwrite } from './../extractSqliteSources'
import { commonCodeJS, commonCodeTS } from './common'
import { Count } from './Count'
import { Enum } from './Enum'
import { FieldRefInput } from './FieldRefInput'
import type { Generatable } from './Generatable'
import { InputType } from './Input'
import { Model } from './Model'
import { PrismaClientClass } from './PrismaClient'

export interface TSClientOptions {
  projectRoot: string
  clientVersion: string
  engineVersion: string
  document: DMMF.Document
  runtimeDir: string
  runtimeName: string
  browser?: boolean
  datasources: InternalDatasource[]
  generator?: GeneratorConfig
  platforms?: Platform[] // TODO: consider making it non-nullable
  sqliteDatasourceOverrides?: DatasourceOverwrite[]
  schemaPath: string
  outputDir: string
  activeProvider: string
  dataProxy: boolean
  deno?: boolean
}

export class TSClient implements Generatable {
  protected readonly dmmf: DMMFHelper
  protected readonly genericsInfo: GenericArgsInfo = new GenericArgsInfo()

  static enabledPreviewFeatures: string[]

  constructor(protected readonly options: TSClientOptions) {
    this.dmmf = new DMMFHelper(klona(options.document))

    TSClient.enabledPreviewFeatures = this.options.generator?.previewFeatures ?? []
  }

  public async toJS(edge = false): Promise<string> {
    const {
      platforms,
      generator,
      sqliteDatasourceOverrides,
      outputDir,
      schemaPath,
      runtimeDir,
      runtimeName,
      datasources,
      dataProxy,
      deno,
    } = this.options
    const envPaths = getEnvPaths(schemaPath, { cwd: outputDir })

    const relativeEnvPaths = {
      rootEnvPath: envPaths.rootEnvPath && path.relative(outputDir, envPaths.rootEnvPath),
      schemaEnvPath: envPaths.schemaEnvPath && path.relative(outputDir, envPaths.schemaEnvPath),
    }

    // This ensures that any engine override is propagated to the generated clients config
    const engineType = getClientEngineType(generator!)
    if (generator) {
      generator.config.engineType = engineType
    }

    const config: Omit<GetPrismaClientConfig, 'document' | 'dirname'> = {
      generator,
      relativeEnvPaths,
      sqliteDatasourceOverrides,
      relativePath: path.relative(outputDir, path.dirname(schemaPath)),
      clientVersion: this.options.clientVersion,
      engineVersion: this.options.engineVersion,
      datasourceNames: datasources.map((d) => d.name),
      activeProvider: this.options.activeProvider,
      dataProxy: this.options.dataProxy,
    }

    // get relative output dir for it to be preserved even after bundling, or
    // being moved around as long as we keep the same project dir structure.
    const relativeOutdir = path.relative(process.cwd(), outputDir)

    const code = `${commonCodeJS({ ...this.options, browser: false })}
${buildRequirePath(edge)}
${buildDirname(edge, relativeOutdir, runtimeDir)}

/**
 * Enums
 */
// Based on
// https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275
function makeEnum(x) { return x; }

${this.dmmf.schema.enumTypes.prisma.map((type) => new Enum(type, true).toJS()).join('\n\n')}
${this.dmmf.schema.enumTypes.model?.map((type) => new Enum(type, false).toJS()).join('\n\n') ?? ''}

${new Enum(
  {
    name: 'ModelName',
    values: this.dmmf.mappings.modelOperations.map((m) => m.model),
  },
  true,
).toJS()}
${buildDMMF(dataProxy, this.options.document)}

/**
 * Create the Client
 */
const config = ${JSON.stringify(config, null, 2)}
config.dirname = dirname
config.document = dmmf
${await buildInlineSchema(dataProxy, schemaPath)}
${buildInlineDatasource(dataProxy, datasources)}
${buildInjectableEdgeEnv(edge, datasources)}
${buildWarnEnvConflicts(edge, runtimeDir, runtimeName)}
${buildDebugInitialization(edge)}
const PrismaClient = getPrismaClient(config)
exports.PrismaClient = PrismaClient
Object.assign(exports, Prisma)${deno ? '\nexport { exports as default, Prisma, PrismaClient }' : ''}
${buildNFTAnnotations(dataProxy, engineType, platforms, relativeOutdir)}
`
    return code
  }
  public toTS(edge = false): string {
    // edge exports the same ts definitions as the index
    if (edge === true) return `export * from './index'`

    const prismaClientClass = new PrismaClientClass(
      this.dmmf,
      this.options.datasources,
      this.options.outputDir,
      this.options.browser,
      this.options.generator,
      this.options.sqliteDatasourceOverrides,
      path.dirname(this.options.schemaPath),
    )

    const commonCode = commonCodeTS(this.options)
    const modelAndTypes = Object.values(this.dmmf.typeAndModelMap).reduce((acc, modelOrType) => {
      if (this.dmmf.outputTypeMap[modelOrType.name]) {
        acc.push(new Model(modelOrType, this.dmmf, this.genericsInfo, this.options.generator))
      }
      return acc
    }, [] as Model[])

    // TODO: Make this code more efficient and directly return 2 arrays

    const prismaEnums = this.dmmf.schema.enumTypes.prisma.map((type) => new Enum(type, true).toTS())

    const modelEnums = this.dmmf.schema.enumTypes.model?.map((type) => new Enum(type, false).toTS())

    const fieldRefs = this.dmmf.schema.fieldRefTypes.prisma?.map((type) => new FieldRefInput(type).toTS()) ?? []

    const countTypes: Count[] = this.dmmf.schema.outputObjectTypes.prisma
      .filter((t) => t.name.endsWith('CountOutputType'))
      .map((t) => new Count(t, this.dmmf, this.genericsInfo, this.options.generator))

    const code = `
/**
 * Client
**/

${commonCode.tsWithoutNamespace()}

${modelAndTypes.map((m) => m.toTSWithoutNamespace()).join('\n')}
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
${modelAndTypes.map((model) => model.toTS()).join('\n')}

/**
 * Enums
 */

// Based on
// https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275

${prismaEnums.join('\n\n')}
${
  fieldRefs.length > 0
    ? `
/**
 * Field references 
 */

${fieldRefs.join('\n\n')}`
    : ''
}
/**
 * Deep Input Types
 */

${this.dmmf.inputObjectTypes.prisma
  .reduce((acc, inputType) => {
    if (inputType.name.includes('Json') && inputType.name.includes('Filter')) {
      const needsGeneric = this.genericsInfo.inputTypeNeedsGenericModelArg(inputType)
      const innerName = needsGeneric ? `${inputType.name}Base<$PrismaModel>` : `${inputType.name}Base`
      const typeName = needsGeneric ? `${inputType.name}<$PrismaModel = never>` : inputType.name
      // This generates types for JsonFilter to prevent the usage of 'path' without another parameter
      const baseName = `Required<${innerName}>`
      acc.push(`export type ${typeName} = 
  | PatchUndefined<
      Either<${baseName}, Exclude<keyof ${baseName}, 'path'>>,
      ${baseName}
    >
  | OptionalFlat<Omit<${baseName}, 'path'>>`)
      acc.push(new InputType({ ...inputType, name: `${inputType.name}Base` }, this.genericsInfo).toTS())
    } else {
      acc.push(new InputType(inputType, this.genericsInfo).toTS())
    }
    return acc
  }, [] as string[])
  .join('\n')}

${
  this.dmmf.inputObjectTypes.model?.map((inputType) => new InputType(inputType, this.genericsInfo).toTS()).join('\n') ??
  ''
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
export const dmmf: runtime.BaseDMMF
`,
  2,
)}}`

    return code
  }

  public toBrowserJS(): string {
    const code = `${commonCodeJS({
      ...this.options,
      runtimeName: 'index-browser',
      browser: true,
    })}
/**
 * Enums
 */
// Based on
// https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275
function makeEnum(x) { return x; }

${this.dmmf.schema.enumTypes.prisma.map((type) => new Enum(type, true).toJS()).join('\n\n')}
${this.dmmf.schema.enumTypes.model?.map((type) => new Enum(type, false).toJS()).join('\n\n') ?? ''}

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
