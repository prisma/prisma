import type { O } from 'ts-toolbelt'

import { DMMFHelper } from '../dmmf'
import { generatedFileNameMapper, importFileNameMapper } from '../file-extensions'
import type { FileMap } from '../generateClient'
import { GenerateClientOptions } from '../generateClient'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import { createClassFile } from './file-generators/ClassFile'
import { createClientFile } from './file-generators/ClientFile'
import { createCommonInputTypeFiles } from './file-generators/CommonInputTypesFile'
import { createEnumsFile } from './file-generators/EnumsFile'
import { createModelFile } from './file-generators/ModelFile'
import { createModelsFile } from './file-generators/ModelsFile'
import { createPrismaNamespaceFile } from './file-generators/PrismaNamespaceFile'
import { GenerateContext } from './GenerateContext'

export type RuntimeName = 'binary' | 'library' | 'wasm' | 'edge' | 'react-native' | 'client' | (string & {})

export type TSClientOptions = O.Required<GenerateClientOptions, 'runtimeBase'> & {
  /** The name of the runtime bundle to use */
  runtimeName: RuntimeName
  /** When we are generating an edge-compatible client */
  edge: boolean
}

export class TSClient {
  protected readonly dmmf: DMMFHelper
  protected readonly genericsInfo: GenericArgsInfo

  constructor(protected readonly options: TSClientOptions) {
    this.dmmf = new DMMFHelper(options.dmmf)
    this.genericsInfo = new GenericArgsInfo(this.dmmf)
  }

  generateClientFiles(): FileMap {
    const context = new GenerateContext({
      dmmf: this.dmmf,
      genericArgsInfo: this.genericsInfo,
      runtimeImport: `${this.options.runtimeBase}/${this.options.runtimeName}`,
      outputFileName: generatedFileNameMapper(this.options.generatedFileExtension),
      importFileName: importFileNameMapper(this.options.importFileExtension),
      moduleFormat: this.options.moduleFormat,
      generator: this.options.generator,
    })

    const modelNames = Object.values(context.dmmf.typeAndModelMap)
      .filter((model) => context.dmmf.outputTypeMap.model[model.name])
      .map((model) => model.name)

    const modelsFileMap: FileMap = modelNames.reduce((acc, modelName) => {
      acc[context.outputFileName(modelName)] = createModelFile(context, modelName)
      return acc
    }, {})

    return {
      [context.outputFileName('index')]: `export * from '${context.importFileName('./client')}'`,
      [context.outputFileName('client')]: createClientFile(context, this.options),
      [context.outputFileName('enums')]: createEnumsFile(context),
      [context.outputFileName('commonInputTypes')]: createCommonInputTypeFiles(context),
      [context.outputFileName('models')]: createModelsFile(context, modelNames),
      models: modelsFileMap,
      internal: {
        [context.outputFileName('prismaNamespace')]: createPrismaNamespaceFile(context, this.options),
        [context.outputFileName('class')]: createClassFile(context, this.options),
      },
    }
  }
}
