import type { DMMF } from '@prisma/generator-helper'

import { applyMixins } from '../runtime/utils/applyMixins'
import type { Dictionary } from './utils/common'
import { keyBy } from './utils/common'

export class DMMFDatamodelHelper implements Pick<DMMF.Document, 'datamodel'> {
  datamodel: DMMF.Datamodel
  datamodelEnumMap: Dictionary<DMMF.DatamodelEnum>
  modelMap: Dictionary<DMMF.Model>
  typeMap: Dictionary<DMMF.Model>
  typeAndModelMap: Dictionary<DMMF.Model>

  constructor({ datamodel }: Pick<DMMF.Document, 'datamodel'>) {
    this.datamodel = datamodel
    this.datamodelEnumMap = this.getDatamodelEnumMap()
    this.modelMap = this.getModelMap()
    this.typeMap = this.getTypeMap()
    this.typeAndModelMap = this.getTypeModelMap()
  }

  private getDatamodelEnumMap(): Dictionary<DMMF.DatamodelEnum> {
    return keyBy(this.datamodel.enums, 'name')
  }

  private getModelMap(): Dictionary<DMMF.Model> {
    return { ...keyBy(this.datamodel.models, 'name') }
  }

  private getTypeMap(): Dictionary<DMMF.Model> {
    return { ...keyBy(this.datamodel.types, 'name') }
  }

  private getTypeModelMap(): Dictionary<DMMF.Model> {
    return { ...this.getTypeMap(), ...this.getModelMap() }
  }
}

class DMMFMappingsHelper implements Pick<DMMF.Document, 'mappings'> {
  mappings: DMMF.Mappings
  mappingsMap: Dictionary<DMMF.ModelMapping>

  constructor({ mappings }: Pick<DMMF.Document, 'mappings'>) {
    this.mappings = mappings
    this.mappingsMap = this.getMappingsMap()
  }

  private getMappingsMap(): Dictionary<DMMF.ModelMapping> {
    return keyBy(this.mappings.modelOperations, 'model')
  }

  getOtherOperationNames() {
    return [
      Object.values(this.mappings.otherOperations.write),
      Object.values(this.mappings.otherOperations.read),
    ].flat()
  }
}

type NamespacedTypeMap<T> = {
  prisma: Record<string, T>
  model: Record<string, T>
}

class DMMFSchemaHelper implements Pick<DMMF.Document, 'schema'> {
  schema: DMMF.Schema
  queryType: DMMF.OutputType
  mutationType: DMMF.OutputType

  outputTypes: { model: DMMF.OutputType[]; prisma: DMMF.OutputType[] }
  outputTypeMap: NamespacedTypeMap<DMMF.OutputType>

  inputObjectTypes: {
    model?: DMMF.InputType[]
    prisma: DMMF.InputType[]
  }
  inputTypeMap: NamespacedTypeMap<DMMF.InputType>

  enumMap: NamespacedTypeMap<DMMF.SchemaEnum>

  rootFieldMap: Dictionary<DMMF.SchemaField>
  constructor({ schema }: Pick<DMMF.Document, 'schema'>) {
    this.schema = schema

    this.enumMap = this.getEnumMap()

    this.outputTypes = this.getOutputTypes()
    this.outputTypeMap = this.getMergedOutputTypeMap()
    this.resolveOutputTypes()

    this.inputObjectTypes = this.schema.inputObjectTypes
    this.inputTypeMap = this.getInputTypeMap()
    this.resolveInputTypes()
    this.resolveFieldArgumentTypes()

    this.queryType = this.outputTypeMap.prisma.Query
    this.mutationType = this.outputTypeMap.prisma.Mutation
    this.rootFieldMap = this.getRootFieldMap()
  }

  get [Symbol.toStringTag]() {
    return 'DMMFClass'
  }

  outputTypeToMergedOutputType = (outputType: DMMF.OutputType): DMMF.OutputType => {
    return {
      ...outputType,
      fields: outputType.fields,
    }
  }

  private resolveOutputTypes() {
    this.resolveOutputTypesInNamespace('prisma')
    this.resolveOutputTypesInNamespace('model')
  }

  private resolveOutputTypesInNamespace(namespace: DMMF.FieldNamespace) {
    for (const type of this.outputTypes[namespace]) {
      for (const field of type.fields) {
        if (typeof field.outputType.type !== 'string') {
          // should not happen
          continue
        }

        if (field.outputType.location === 'scalar') {
          continue
        }
        const fieldNamespace = field.outputType.namespace ?? 'model'
        if (field.outputType.location === 'outputObjectTypes') {
          field.outputType.type = this.outputTypeMap[fieldNamespace][field.outputType.type]
        } else if (field.outputType.location === 'enumTypes') {
          field.outputType.type = this.enumMap[fieldNamespace][field.outputType.type]
        }
      }
      type.fieldMap = keyBy(type.fields, 'name')
    }
  }

  private resolveInputTypes() {
    this.resolveNamespaceInputTypes('model')
    this.resolveNamespaceInputTypes('prisma')
  }

  private resolveNamespaceInputTypes(namespace: DMMF.FieldNamespace) {
    const types = this.inputObjectTypes[namespace] ?? []
    for (const type of types) {
      for (const field of type.fields) {
        for (const fieldInputType of field.inputTypes) {
          if (typeof fieldInputType.type !== 'string') {
            // should not happen
            continue
          }

          const typeName = fieldInputType.type

          if (fieldInputType.location === 'scalar') {
            continue
          }

          const fieldNamespace = fieldInputType.namespace ?? 'model'
          if (fieldInputType.location === 'inputObjectTypes') {
            fieldInputType.type = this.inputTypeMap[fieldNamespace][typeName]
          }

          if (fieldInputType.location === 'enumTypes') {
            fieldInputType.type = this.enumMap[fieldNamespace][typeName]
          }
        }
      }
      type.fieldMap = keyBy(type.fields, 'name')
    }
  }

  private resolveFieldArgumentTypes() {
    this.resolveFieldArgumentTypesInNamespace('model')
    this.resolveFieldArgumentTypesInNamespace('prisma')
  }

  private resolveFieldArgumentTypesInNamespace(namespace: DMMF.FieldNamespace) {
    const types = this.outputTypes[namespace] ?? []
    for (const type of types) {
      for (const field of type.fields) {
        for (const arg of field.args) {
          for (const argInputType of arg.inputTypes) {
            const typeName = argInputType.type
            if (typeof typeName !== 'string') {
              // should not happen
              continue
            }

            if (argInputType.location === 'scalar') {
              continue
            }

            const argNamespace = argInputType.namespace ?? 'model'
            if (argInputType.location === 'inputObjectTypes') {
              argInputType.type = this.inputTypeMap[argNamespace][typeName]
            }

            if (argInputType.location === 'enumTypes') {
              argInputType.type = this.enumMap[argNamespace][typeName]
            }
          }
        }
      }
    }
  }

  private getOutputTypes(): {
    model: DMMF.OutputType[]
    prisma: DMMF.OutputType[]
  } {
    return {
      model: this.schema.outputObjectTypes.model.map(this.outputTypeToMergedOutputType),
      prisma: this.schema.outputObjectTypes.prisma.map(this.outputTypeToMergedOutputType),
    }
  }

  private getEnumMap(): NamespacedTypeMap<DMMF.SchemaEnum> {
    return {
      prisma: keyBy(this.schema.enumTypes.prisma, 'name'),
      model: this.schema.enumTypes.model ? keyBy(this.schema.enumTypes.model, 'name') : {},
    }
  }

  hasEnumInNamespace(enumName: string, namespace: 'prisma' | 'model'): boolean {
    return this.schema.enumTypes[namespace]?.find((schemaEnum) => schemaEnum.name === enumName) !== undefined
  }

  private getMergedOutputTypeMap(): NamespacedTypeMap<DMMF.OutputType> {
    return {
      model: keyBy(this.outputTypes.model, 'name'),
      prisma: keyBy(this.outputTypes.prisma, 'name'),
    }
  }

  private getInputTypeMap(): NamespacedTypeMap<DMMF.InputType> {
    return {
      prisma: keyBy(this.schema.inputObjectTypes.prisma, 'name'),
      model: this.schema.inputObjectTypes.model ? keyBy(this.schema.inputObjectTypes.model, 'name') : {},
    }
  }

  getRootFieldMap(): Dictionary<DMMF.SchemaField> {
    return { ...keyBy(this.queryType.fields, 'name'), ...keyBy(this.mutationType.fields, 'name') }
  }
}

export interface DMMFHelper extends DMMFDatamodelHelper, DMMFMappingsHelper, DMMFSchemaHelper {}
// TODO: merge into single class
export class DMMFHelper {
  constructor(dmmf: DMMF.Document) {
    return Object.assign(this, new DMMFDatamodelHelper(dmmf), new DMMFMappingsHelper(dmmf), new DMMFSchemaHelper(dmmf))
  }
}

applyMixins(DMMFHelper, [DMMFDatamodelHelper, DMMFMappingsHelper, DMMFSchemaHelper])
