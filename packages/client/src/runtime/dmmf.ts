import type { DMMF } from '@prisma/generator-helper'

import { BaseDMMF } from './dmmf-types'
import { applyMixins } from './utils/applyMixins'
import type { Dictionary } from './utils/common'
import { keyBy, ScalarTypeTable } from './utils/common'

class DMMFDatamodelHelper implements Pick<DMMF.Document, 'datamodel'> {
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

  getDatamodelEnumMap(): Dictionary<DMMF.DatamodelEnum> {
    return keyBy(this.datamodel.enums, 'name')
  }

  getModelMap(): Dictionary<DMMF.Model> {
    return { ...keyBy(this.datamodel.models, 'name') }
  }

  getTypeMap(): Dictionary<DMMF.Model> {
    return { ...keyBy(this.datamodel.types, 'name') }
  }

  getTypeModelMap(): Dictionary<DMMF.Model> {
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

  getMappingsMap(): Dictionary<DMMF.ModelMapping> {
    return keyBy(this.mappings.modelOperations, 'model')
  }

  getOtherOperationNames() {
    return [
      Object.values(this.mappings.otherOperations.write),
      Object.values(this.mappings.otherOperations.read),
    ].flat()
  }
}

class DMMFSchemaHelper implements Pick<DMMF.Document, 'schema'> {
  schema: DMMF.Schema
  queryType: DMMF.OutputType
  mutationType: DMMF.OutputType

  outputTypes: { model: DMMF.OutputType[]; prisma: DMMF.OutputType[] }
  outputTypeMap: Dictionary<DMMF.OutputType>

  inputObjectTypes: {
    model?: DMMF.InputType[]
    prisma: DMMF.InputType[]
  }
  inputTypeMap: Dictionary<DMMF.InputType>

  enumMap: Dictionary<DMMF.SchemaEnum>

  rootFieldMap: Dictionary<DMMF.SchemaField>
  constructor({ schema }: Pick<DMMF.Document, 'schema'>) {
    this.schema = schema

    this.enumMap = this.getEnumMap()

    this.queryType = this.getQueryType()
    this.mutationType = this.getMutationType()

    this.outputTypes = this.getOutputTypes()
    this.outputTypeMap = this.getMergedOutputTypeMap()
    this.resolveOutputTypes()

    this.inputObjectTypes = this.schema.inputObjectTypes
    this.inputTypeMap = this.getInputTypeMap()
    this.resolveInputTypes()
    this.resolveFieldArgumentTypes()

    // needed as references are not kept
    this.queryType = this.outputTypeMap.Query
    this.mutationType = this.outputTypeMap.Mutation
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

  resolveOutputTypes() {
    for (const type of this.outputTypes.model) {
      for (const field of type.fields) {
        if (typeof field.outputType.type === 'string' && !ScalarTypeTable[field.outputType.type]) {
          field.outputType.type =
            this.outputTypeMap[field.outputType.type] ||
            this.outputTypeMap[field.outputType.type] ||
            this.enumMap[field.outputType.type] ||
            field.outputType.type
        }
      }
      type.fieldMap = keyBy(type.fields, 'name')
    }

    for (const type of this.outputTypes.prisma) {
      for (const field of type.fields) {
        if (typeof field.outputType.type === 'string' && !ScalarTypeTable[field.outputType.type]) {
          field.outputType.type =
            this.outputTypeMap[field.outputType.type] ||
            this.outputTypeMap[field.outputType.type] ||
            this.enumMap[field.outputType.type] ||
            field.outputType.type
        }
      }

      type.fieldMap = keyBy(type.fields, 'name')
    }
  }

  resolveInputTypes() {
    const inputTypes = this.inputObjectTypes.prisma

    if (this.inputObjectTypes.model) {
      inputTypes.push(...this.inputObjectTypes.model)
    }

    for (const type of inputTypes) {
      for (const field of type.fields) {
        for (const fieldInputType of field.inputTypes) {
          const fieldType = fieldInputType.type
          if (
            typeof fieldType === 'string' &&
            !ScalarTypeTable[fieldType] &&
            (this.inputTypeMap[fieldType] || this.enumMap[fieldType])
          ) {
            fieldInputType.type = this.inputTypeMap[fieldType] || this.enumMap[fieldType] || fieldType
          }
        }
      }
      type.fieldMap = keyBy(type.fields, 'name')
    }
  }

  resolveFieldArgumentTypes() {
    for (const type of this.outputTypes.prisma) {
      for (const field of type.fields) {
        for (const arg of field.args) {
          for (const argInputType of arg.inputTypes) {
            const argType = argInputType.type
            if (typeof argType === 'string' && !ScalarTypeTable[argType]) {
              argInputType.type = this.inputTypeMap[argType] || this.enumMap[argType] || argType
            }
          }
        }
      }
    }

    for (const type of this.outputTypes.model) {
      for (const field of type.fields) {
        for (const arg of field.args) {
          for (const argInputType of arg.inputTypes) {
            const argType = argInputType.type
            if (typeof argType === 'string' && !ScalarTypeTable[argType]) {
              argInputType.type = this.inputTypeMap[argType] || this.enumMap[argType] || argInputType.type
            }
          }
        }
      }
    }
  }

  getQueryType(): DMMF.OutputType {
    return this.schema.outputObjectTypes.prisma.find((t) => t.name === 'Query')!
  }

  getMutationType(): DMMF.OutputType {
    return this.schema.outputObjectTypes.prisma.find((t) => t.name === 'Mutation')!
  }

  getOutputTypes(): {
    model: DMMF.OutputType[]
    prisma: DMMF.OutputType[]
  } {
    return {
      model: this.schema.outputObjectTypes.model.map(this.outputTypeToMergedOutputType),
      prisma: this.schema.outputObjectTypes.prisma.map(this.outputTypeToMergedOutputType),
    }
  }

  getEnumMap(): Dictionary<DMMF.SchemaEnum> {
    return {
      ...keyBy(this.schema.enumTypes.prisma, 'name'),
      ...(this.schema.enumTypes.model ? keyBy(this.schema.enumTypes.model, 'name') : undefined),
    }
  }

  hasEnumInNamespace(enumName: string, namespace: 'prisma' | 'model'): boolean {
    return this.schema.enumTypes[namespace]?.find((schemaEnum) => schemaEnum.name === enumName) !== undefined
  }

  getMergedOutputTypeMap(): Dictionary<DMMF.OutputType> {
    return {
      ...keyBy(this.outputTypes.model, 'name'),
      ...keyBy(this.outputTypes.prisma, 'name'),
    }
  }

  getInputTypeMap(): Dictionary<DMMF.InputType> {
    return {
      ...(this.schema.inputObjectTypes.model ? keyBy(this.schema.inputObjectTypes.model, 'name') : undefined),
      ...keyBy(this.schema.inputObjectTypes.prisma, 'name'),
    }
  }

  getRootFieldMap(): Dictionary<DMMF.SchemaField> {
    return { ...keyBy(this.queryType.fields, 'name'), ...keyBy(this.mutationType.fields, 'name') }
  }
}

export interface BaseDMMFHelper extends DMMFDatamodelHelper, DMMFMappingsHelper {}
export class BaseDMMFHelper {
  constructor(dmmf: BaseDMMF) {
    return Object.assign(this, new DMMFDatamodelHelper(dmmf), new DMMFMappingsHelper(dmmf))
  }
}

applyMixins(BaseDMMFHelper, [DMMFDatamodelHelper, DMMFMappingsHelper])

export interface DMMFHelper extends BaseDMMFHelper, DMMFSchemaHelper {}
export class DMMFHelper {
  constructor(dmmf: DMMF.Document) {
    return Object.assign(this, new BaseDMMFHelper(dmmf), new DMMFSchemaHelper(dmmf))
  }
}

applyMixins(DMMFHelper, [BaseDMMFHelper, DMMFSchemaHelper])
