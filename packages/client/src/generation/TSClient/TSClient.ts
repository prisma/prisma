import type { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import type { Platform } from '@prisma/get-platform'
import { getClientEngineType, getEnvPaths } from '@prisma/internals'
import ciInfo from 'ci-info'
import indent from 'indent-string'
import { klona } from 'klona'
import path from 'path'

import { DMMFHelper } from '../../runtime/dmmf'
import type { DMMF } from '../../runtime/dmmf-types'
import type { GetPrismaClientConfig } from '../../runtime/getPrismaClient'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import { buildDebugInitialization } from '../utils/buildDebugInitialization'
import { buildDirname } from '../utils/buildDirname'
import { buildDMMF } from '../utils/buildDMMF'
import { buildEdgeClientProtocol } from '../utils/buildEdgeClientProtocol'
import { buildExports } from '../utils/buildExports'
import { buildInjectableEdgeEnv } from '../utils/buildInjectableEdgeEnv'
import { buildInlineDatasource } from '../utils/buildInlineDatasources'
import { buildInlineSchema } from '../utils/buildInlineSchema'
import { buildNFTAnnotations } from '../utils/buildNFTAnnotations'
import { buildNodeImports } from '../utils/buildNodeImports'
import { buildWarnEnvConflicts } from '../utils/buildWarnEnvConflicts'
import { commonCodeJS, commonCodeTS } from './common'
import { Count } from './Count'
import { Enum } from './Enum'
import { FieldRefInput } from './FieldRefInput'
import type { Generatable } from './Generatable'
import { InputType } from './Input'
import { Model } from './Model'
import { PrismaClientClass } from './PrismaClient'

export interface TSClientOptions {
  clientVersion: string
  engineVersion: string
  document: DMMF.Document
  runtimeDir: string
  runtimeName: string
  datasources: DataSource[]
  generator?: GeneratorConfig
  platforms?: Platform[] // TODO: consider making it non-nullable
  schemaPath: string
  outputDir: string
  activeProvider: string
  postinstall?: boolean
  dataProxy: boolean
  browser: boolean
  edge: boolean
  esm: boolean
}

export class TSClient implements Generatable {
  protected readonly dmmf: DMMFHelper
  protected readonly genericsInfo: GenericArgsInfo = new GenericArgsInfo()

  static enabledPreviewFeatures: string[]

  constructor(protected readonly options: TSClientOptions) {
    this.dmmf = new DMMFHelper(klona(options.document))

    TSClient.enabledPreviewFeatures = this.options.generator?.previewFeatures ?? []
  }

  public async toJS(): Promise<string> {
    const { generator, outputDir, schemaPath, datasources } = this.options
    const envPaths = getEnvPaths(schemaPath, { cwd: outputDir })

    const relativeEnvPaths = {
      rootEnvPath: envPaths.rootEnvPath && path.relative(outputDir, envPaths.rootEnvPath),
      schemaEnvPath: envPaths.schemaEnvPath && path.relative(outputDir, envPaths.schemaEnvPath),
    }

    // This ensures that any engine override is propagated to the generated clients config
    if (generator) {
      generator.config.engineType = getClientEngineType(generator)
    }

    const config: Omit<GetPrismaClientConfig, 'runtimeDataModel' | 'dirname'> = {
      generator,
      relativeEnvPaths,
      relativePath: path.relative(outputDir, path.dirname(schemaPath)),
      clientVersion: this.options.clientVersion,
      engineVersion: this.options.engineVersion,
      datasourceNames: datasources.map((d) => d.name),
      activeProvider: this.options.activeProvider,
      dataProxy: this.options.dataProxy,
      postinstall: this.options.postinstall,
      ciName: ciInfo.name ?? undefined,
    }

    // get relative output dir for it to be preserved even after bundling, or
    // being moved around as long as we keep the same project dir structure.
    const relativeOutdir = path.relative(process.cwd(), outputDir)

    const code = `${buildNodeImports(this.options)}
${commonCodeJS(this.options)}

/**
 * Enums
 */

${this.dmmf.schema.enumTypes.prisma.map((type) => new Enum(type, true, this.options).toJS()).join('\n\n')}
${this.dmmf.schema.enumTypes.model?.map((type) => new Enum(type, false, this.options).toJS()).join('\n\n') ?? ''}

${new Enum(
  {
    name: 'ModelName',
    values: this.dmmf.mappings.modelOperations.map((m) => m.model),
  },
  true,
  this.options,
).toJS()}
/**
 * Create the Client
 */
const config = ${JSON.stringify(config, null, 2)}
${buildDirname(this.options, relativeOutdir)}
${buildDMMF(this.options)}
${await buildInlineSchema(this.options)}
${buildInlineDatasource(this.options)}
${buildInjectableEdgeEnv(this.options)}
${buildWarnEnvConflicts(this.options)}
${buildEdgeClientProtocol(this.options)}
${buildDebugInitialization(this.options)}
${buildNFTAnnotations(this.options, relativeOutdir)}
const PrismaClient = getPrismaClient(config)
${buildExports(this.options)}
`
    return code
  }
  public toTS(): string {
    // edge exports the same ts definitions as the index
    if (this.options.edge === true) return `export * from './index'`

    const prismaClientClass = new PrismaClientClass(
      this.dmmf,
      this.options.datasources,
      this.options.outputDir,
      this.options.browser,
      this.options.generator,
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

    const prismaEnums = this.dmmf.schema.enumTypes.prisma.map((type) => new Enum(type, true, this.options).toTS())

    const modelEnums = this.dmmf.schema.enumTypes.model?.map((type) => new Enum(type, false, this.options).toTS())

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
  this.options,
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

${this.dmmf.schema.enumTypes.prisma.map((type) => new Enum(type, true, this.options).toJS()).join('\n\n')}
${this.dmmf.schema.enumTypes.model?.map((type) => new Enum(type, false, this.options).toJS()).join('\n\n') ?? ''}

${new Enum(
  {
    name: 'ModelName',
    values: this.dmmf.mappings.modelOperations.map((m) => m.model),
  },
  true,
  this.options,
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

${buildExports(this.options)}
`
    return code
  }
}
