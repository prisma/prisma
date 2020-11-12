import { DMMF } from '@prisma/generator-helper'
import { Dictionary, keyBy, ScalarTypeTable, keyBy2 } from './utils/common'

export class DMMFClass implements DMMF.Document {
  public datamodel: DMMF.Datamodel
  public schema: DMMF.Schema
  public mappings: DMMF.Mappings
  public queryType: DMMF.OutputType
  public mutationType: DMMF.OutputType

  public outputTypes: { model: DMMF.OutputType[], prisma: DMMF.OutputType[] }
  public outputTypeMap: { model: Dictionary<DMMF.OutputType>, prisma: Dictionary<DMMF.OutputType> }

  public inputObjectTypes: { model?: DMMF.InputType[], prisma: DMMF.InputType[] }
  public inputTypeMap: { model?: Dictionary<DMMF.InputType>, prisma: Dictionary<DMMF.InputType> }

  public enumMap: { model?: Dictionary<DMMF.SchemaEnum>, prisma: Dictionary<DMMF.SchemaEnum> }

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
    this.queryType = this.outputTypeMap.prisma.Query
    this.mutationType = this.outputTypeMap.prisma.Mutation
    this.outputTypes = this.outputTypes
    this.rootFieldMap = this.getRootFieldMap()
  }
  protected outputTypeToMergedOutputType = (
    outputType: DMMF.OutputType,
  ): DMMF.OutputType => {
    const model = this.modelMap[outputType.name]
    return {
      ...outputType,
      isEmbedded: model ? model.isEmbedded : false,
      fields: outputType.fields,
    }
  }
  protected resolveOutputTypes() {
    for (const type of this.outputTypes.model.concat(this.outputTypes.prisma)) {
      for (const field of type.fields) {
        if (
          typeof field.outputType.type === 'string' &&
          !ScalarTypeTable[field.outputType.type]
        ) {
          field.outputType.type =
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
        const first = field.inputTypes[0].type
        if (
          typeof first === 'string' &&
          !ScalarTypeTable[first] &&
          (this.inputTypeMap[first] || this.enumMap[first])
        ) {
          field.inputTypes[0].type =
            this.inputTypeMap[first] ||
            this.enumMap[first] ||
            field.inputTypes[0].type
        }
        const second = field.inputTypes[1] && field.inputTypes[1].type
        if (
          typeof second === 'string' &&
          !ScalarTypeTable[second] &&
          (this.inputTypeMap[second] || this.enumMap[second])
        ) {
          field.inputTypes[1].type =
            this.inputTypeMap[second] ||
            this.enumMap[second] ||
            field.inputTypes[1].type
        }
      }
      type.fieldMap = keyBy(type.fields, 'name')
    }
  }
  protected resolveFieldArgumentTypes(
    // types: DMMF.OutputType[],
    // inputTypeMap: Dictionary<DMMF.InputType>,
  ) {
    // todo: replace with faster option
    for (const type of this.outputTypes.prisma.concat(this.outputTypes.model)) {
      for (const field of type.fields) {
        for (const arg of field.args) {
          const first = arg.inputTypes[0].type
          if (typeof first === 'string' && !ScalarTypeTable[first]) {
            arg.inputTypes[0].type =
              this.inputTypeMap.prisma[first] ||
              (this.inputTypeMap.model && this.inputTypeMap.model[first]) ||
              this.enumMap[first] ||
              arg.inputTypes[0].type
          }
          const second = arg.inputTypes[1] && arg.inputTypes[1].type
          if (
            second &&
            typeof second === 'string' &&
            !ScalarTypeTable[second]
          ) {
            arg.inputTypes[1].type =
              this.inputTypeMap.prisma[second] ||
              (this.inputTypeMap.model && this.inputTypeMap.model[second]) ||
              this.enumMap[second] ||
              arg.inputTypes[1].type
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
  protected getOutputTypes(): { model: DMMF.OutputType[], prisma: DMMF.OutputType[] } {
    return {
      model: this.schema.outputObjectTypes.model.map(this.outputTypeToMergedOutputType),
      prisma: this.schema.outputObjectTypes.prisma.map(this.outputTypeToMergedOutputType),
    }
  }
  protected getDatamodelEnumMap(): Dictionary<DMMF.DatamodelEnum> {
    return keyBy(this.datamodel.enums, 'name')
  }
  protected getEnumMap(): { model?: Dictionary<DMMF.SchemaEnum>, prisma: Dictionary<DMMF.SchemaEnum> } {
    return {
      prisma: keyBy(this.schema.enumTypes.prisma, 'name'),
      model: this.schema.enumTypes.model ? keyBy(this.schema.enumTypes.model, 'name') : undefined,
    }
  }
  protected getModelMap(): Dictionary<DMMF.Model> {
    return keyBy(this.datamodel.models, 'name')
  }
  protected getMergedOutputTypeMap(): { model: Dictionary<DMMF.OutputType>, prisma: Dictionary<DMMF.OutputType> } {
    return {
      model: keyBy(this.outputTypes.model, 'name'),
      prisma: keyBy(this.outputTypes.prisma, 'name'),
    }
  }
  protected getInputTypeMap(): { model?: Dictionary<DMMF.InputType>, prisma: Dictionary<DMMF.InputType> } {
    return {
      model: this.schema.inputObjectTypes.model ? keyBy(this.schema.inputObjectTypes.model, 'name') : undefined,
      prisma: keyBy(this.schema.inputObjectTypes.prisma, 'name'),
    }
  }
  protected getMappingsMap(): Dictionary<DMMF.ModelMapping> {
    return keyBy(this.mappings.modelOperations, 'model')
  }
  protected getRootFieldMap(): Dictionary<DMMF.SchemaField> {
    return keyBy2(this.queryType.fields, this.mutationType.fields, 'name')
  }
}
