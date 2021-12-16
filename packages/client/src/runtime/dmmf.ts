import type { DMMF } from '@prisma/generator-helper'
import type { Dictionary } from './utils/common'
import { keyBy, keyBy2, ScalarTypeTable } from './utils/common'

export class DMMFClass implements DMMF.Document {
  public datamodel: DMMF.Datamodel
  public schema: DMMF.Schema
  public mappings: DMMF.Mappings
  public queryType: DMMF.OutputType
  public mutationType: DMMF.OutputType

  public outputTypes: { model: DMMF.OutputType[]; prisma: DMMF.OutputType[] }
  public outputTypeMap: Dictionary<DMMF.OutputType>

  public inputObjectTypes: {
    model?: DMMF.InputType[]
    prisma: DMMF.InputType[]
  }
  public inputTypeMap: Dictionary<DMMF.InputType>

  public enumMap: Dictionary<DMMF.SchemaEnum>

  public datamodelEnumMap: Dictionary<DMMF.DatamodelEnum>
  public modelMap: Dictionary<DMMF.Model>
  public mappingsMap: Dictionary<DMMF.ModelMapping>
  public rootFieldMap: Dictionary<DMMF.SchemaField>
  constructor({ datamodel, schema, mappings }: DMMF.Document) {
    this.datamodel = datamodel
    this.schema = schema

    this.mappings = mappings
    this.enumMap = this.getEnumMap()
    this.datamodelEnumMap = this.getDatamodelEnumMap()
    this.queryType = this.getQueryType()
    this.mutationType = this.getMutationType()
    this.modelMap = this.getModelMap()

    this.outputTypes = this.getOutputTypes()

    this.outputTypeMap = this.getMergedOutputTypeMap()

    this.resolveOutputTypes()

    this.inputObjectTypes = this.schema.inputObjectTypes
    this.inputTypeMap = this.getInputTypeMap()
    this.resolveInputTypes()
    this.resolveFieldArgumentTypes()
    this.mappingsMap = this.getMappingsMap()

    // needed as references are not kept
    this.queryType = this.outputTypeMap.Query
    this.mutationType = this.outputTypeMap.Mutation
    this.rootFieldMap = this.getRootFieldMap()
  }
  get [Symbol.toStringTag]() {
    return 'DMMFClass'
  }
  protected outputTypeToMergedOutputType = (outputType: DMMF.OutputType): DMMF.OutputType => {
    return {
      ...outputType,
      fields: outputType.fields,
    }
  }
  protected resolveOutputTypes() {
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
  protected resolveInputTypes() {
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
  protected resolveFieldArgumentTypes() {
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
  protected getQueryType(): DMMF.OutputType {
    return this.schema.outputObjectTypes.prisma.find((t) => t.name === 'Query')!
  }
  protected getMutationType(): DMMF.OutputType {
    return this.schema.outputObjectTypes.prisma.find((t) => t.name === 'Mutation')!
  }
  protected getOutputTypes(): {
    model: DMMF.OutputType[]
    prisma: DMMF.OutputType[]
  } {
    return {
      model: this.schema.outputObjectTypes.model.map(this.outputTypeToMergedOutputType),
      prisma: this.schema.outputObjectTypes.prisma.map(this.outputTypeToMergedOutputType),
    }
  }
  protected getDatamodelEnumMap(): Dictionary<DMMF.DatamodelEnum> {
    return keyBy(this.datamodel.enums, 'name')
  }
  protected getEnumMap(): Dictionary<DMMF.SchemaEnum> {
    return {
      ...keyBy(this.schema.enumTypes.prisma, 'name'),
      ...(this.schema.enumTypes.model ? keyBy(this.schema.enumTypes.model, 'name') : undefined),
    }
  }
  protected getModelMap(): Dictionary<DMMF.Model> {
    return keyBy(this.datamodel.models, 'name')
  }
  protected getMergedOutputTypeMap(): Dictionary<DMMF.OutputType> {
    return {
      ...keyBy(this.outputTypes.model, 'name'),
      ...keyBy(this.outputTypes.prisma, 'name'),
    }
  }
  protected getInputTypeMap(): Dictionary<DMMF.InputType> {
    return {
      ...(this.schema.inputObjectTypes.model ? keyBy(this.schema.inputObjectTypes.model, 'name') : undefined),
      ...keyBy(this.schema.inputObjectTypes.prisma, 'name'),
    }
  }
  protected getMappingsMap(): Dictionary<DMMF.ModelMapping> {
    return keyBy(this.mappings.modelOperations, 'model')
  }
  protected getRootFieldMap(): Dictionary<DMMF.SchemaField> {
    return keyBy2(this.queryType.fields, this.mutationType.fields, 'name')
  }
}
