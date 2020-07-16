import { DMMF } from './dmmf-types'
import { Dictionary, keyBy, ScalarTypeTable, keyBy2 } from './utils/common'

export class DMMFClass implements DMMF.Document {
  public datamodel: DMMF.Datamodel
  public schema: DMMF.Schema
  public mappings: DMMF.Mapping[]
  public queryType: DMMF.OutputType
  public mutationType: DMMF.OutputType
  public outputTypes: DMMF.OutputType[]
  public outputTypeMap: Dictionary<DMMF.OutputType> = {}
  public inputTypes: DMMF.InputType[]
  public inputTypeMap: Dictionary<DMMF.InputType>
  public enumMap: Dictionary<DMMF.Enum>
  public modelMap: Dictionary<DMMF.Model>
  public mappingsMap: Dictionary<DMMF.Mapping>
  public rootFieldMap: Dictionary<DMMF.SchemaField>
  constructor({ datamodel, schema, mappings }: DMMF.Document) {
    this.datamodel = datamodel
    this.schema = schema
    this.mappings = mappings
    this.enumMap = this.getEnumMap()
    this.queryType = this.getQueryType()
    this.mutationType = this.getMutationType()
    this.modelMap = this.getModelMap()

    this.outputTypes = this.getOutputTypes()

    this.outputTypeMap = this.getMergedOutputTypeMap()

    this.resolveOutputTypes(this.outputTypes)

    this.inputTypes = this.schema.inputTypes
    this.inputTypeMap = this.getInputTypeMap()
    this.resolveInputTypes(this.inputTypes)
    this.resolveFieldArgumentTypes(this.outputTypes, this.inputTypeMap)
    this.mappingsMap = this.getMappingsMap()

    // needed as references are not kept
    this.queryType = this.outputTypeMap.Query
    this.mutationType = this.outputTypeMap.Mutation
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
  protected resolveOutputTypes(types: DMMF.OutputType[]) {
    for (const type of types) {
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
  protected resolveInputTypes(types: DMMF.InputType[]) {
    for (const type of types) {
      for (const field of type.fields) {
        const first = field.inputType[0].type
        if (
          typeof first === 'string' &&
          !ScalarTypeTable[first] &&
          (this.inputTypeMap[first] || this.enumMap[first])
        ) {
          field.inputType[0].type =
            this.inputTypeMap[first] ||
            this.enumMap[first] ||
            field.inputType[0].type
        }
        const second = field.inputType[1] && field.inputType[1].type
        if (
          typeof second === 'string' &&
          !ScalarTypeTable[second] &&
          (this.inputTypeMap[second] || this.enumMap[second])
        ) {
          field.inputType[1].type =
            this.inputTypeMap[second] ||
            this.enumMap[second] ||
            field.inputType[1].type
        }
      }
      type.fieldMap = keyBy(type.fields, 'name')
    }
  }
  protected resolveFieldArgumentTypes(
    types: DMMF.OutputType[],
    inputTypeMap: Dictionary<DMMF.InputType>,
  ) {
    for (const type of types) {
      for (const field of type.fields) {
        for (const arg of field.args) {
          const first = arg.inputType[0].type
          if (typeof first === 'string' && !ScalarTypeTable[first]) {
            arg.inputType[0].type =
              inputTypeMap[first] ||
              this.enumMap[first] ||
              arg.inputType[0].type
          }
          const second = arg.inputType[1] && arg.inputType[1].type
          if (
            second &&
            typeof second === 'string' &&
            !ScalarTypeTable[second]
          ) {
            arg.inputType[1].type =
              inputTypeMap[second] ||
              this.enumMap[second] ||
              arg.inputType[1].type
          }
        }
      }
    }
  }
  protected getQueryType(): DMMF.OutputType {
    return this.schema.outputTypes.find((t) => t.name === 'Query')!
  }
  protected getMutationType(): DMMF.OutputType {
    return this.schema.outputTypes.find((t) => t.name === 'Mutation')!
  }
  protected getOutputTypes(): DMMF.OutputType[] {
    return this.schema.outputTypes.map(this.outputTypeToMergedOutputType)
  }
  protected getEnumMap(): Dictionary<DMMF.Enum> {
    return keyBy(this.schema.enums, 'name')
  }
  protected getModelMap(): Dictionary<DMMF.Model> {
    return keyBy(this.datamodel.models, 'name')
  }
  protected getMergedOutputTypeMap(): Dictionary<DMMF.OutputType> {
    return keyBy(this.outputTypes, 'name')
  }
  protected getInputTypeMap(): Dictionary<DMMF.InputType> {
    return keyBy(this.schema.inputTypes, 'name')
  }
  protected getMappingsMap(): Dictionary<DMMF.Mapping> {
    return keyBy(this.mappings, 'model')
  }
  protected getRootFieldMap(): Dictionary<DMMF.SchemaField> {
    return keyBy2(this.queryType.fields, this.mutationType.fields, 'name')
  }
}
