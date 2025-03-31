import { getClientEngineType } from '@prisma/internals'
import * as ts from '@prisma/ts-builders'
import type { O } from 'ts-toolbelt'

import { DMMFHelper } from '../dmmf'
import type { FileMap } from '../generateClient'
import { GenerateClientOptions } from '../generateClient'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import { createClassFile } from './file-generators/ClassFile'
import { createCommonFile } from './file-generators/CommonFile'
import { createCommonInputTypeFiles } from './file-generators/CommonInputTypesFile'
import { createEnumsFile } from './file-generators/EnumsFile'
import { createModelFiles } from './file-generators/ModelFiles'
import { createModelsFile } from './file-generators/ModelsFile'
import { type Generable } from './Generable'
import { GenerateContext } from './GenerateContext'
import { Model } from './Model'

export type RuntimeName = 'binary' | 'library' | 'wasm' | 'edge' | 'react-native' | 'client' | (string & {})

export type TSClientOptions = O.Required<GenerateClientOptions, 'runtimeBase'> & {
  /** The name of the runtime bundle to use */
  runtimeName: RuntimeName
  /** When we are generating an edge-compatible client */
  edge: boolean
}

export class TSClient implements Generable {
  protected readonly dmmf: DMMFHelper
  protected readonly genericsInfo: GenericArgsInfo

  constructor(protected readonly options: TSClientOptions) {
    this.dmmf = new DMMFHelper(options.dmmf)
    this.genericsInfo = new GenericArgsInfo(this.dmmf)
  }

  public toTS(): string {
    // This ensures that any engine override is propagated to the generated clients config
    const clientEngineType = getClientEngineType(this.options.generator)
    this.options.generator.config.engineType = clientEngineType

    const context = new GenerateContext({
      dmmf: this.dmmf,
      genericArgsInfo: this.genericsInfo,
      generator: this.options.generator,
      runtimeJsPath: `${this.options.runtimeBase}/${this.options.runtimeName}`,
    })

    const modelAndTypes = Object.values(context.dmmf.typeAndModelMap)
      .filter((modelOrType) => context.dmmf.outputTypeMap.model[modelOrType.name])
      .map((modelOrType) => new Model(modelOrType, context))

    const modelEnumsAliases = this.dmmf.datamodel.enums.map((datamodelEnum) => {
      return [
        ts.stringify(
          ts.moduleExport(ts.typeDeclaration(datamodelEnum.name, ts.namedType(`$Enums.${datamodelEnum.name}`))),
        ),
        ts.stringify(
          ts.moduleExport(
            ts.constDeclaration(datamodelEnum.name).setValue(ts.namedValue(`$Enums.${datamodelEnum.name}`)),
          ),
        ),
      ].join('\n')
    })

    return `
import * as runtime from '${context.runtimeJsPath}'
import type * as Prisma from './common'
export * as Prisma from './common'
export { PrismaClient } from './class'

${context.dmmf.datamodel.enums.length > 0 ? `import type * as $Enums from './enums'` : ''}
${context.dmmf.datamodel.enums.length > 0 ? `export type * as $Enums from './enums'` : ''}

${modelAndTypes.map((m) => m.toTSWithoutNamespace()).join('\n')}
${modelEnumsAliases.length > 0 ? `${modelEnumsAliases.join('\n\n')}` : ''}
`
  }

  generateModelAndHelperFiles(): FileMap {
    const context = new GenerateContext({
      dmmf: this.dmmf,
      genericArgsInfo: this.genericsInfo,
      generator: this.options.generator,
      runtimeJsPath: `${this.options.runtimeBase}/${this.options.runtimeName}`,
    })

    const modelsFileMap: FileMap = createModelFiles(context)

    return {
      'models.ts': createModelsFile(context, modelsFileMap),
      'common.ts': createCommonFile(context, this.options),
      'commonInputTypes.ts': createCommonInputTypeFiles(context),
      'class.ts': createClassFile(context, this.options),
      'enums.ts': createEnumsFile(context),
      models: modelsFileMap,
    }
  }
}
