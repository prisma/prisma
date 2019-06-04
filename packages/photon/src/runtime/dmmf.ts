import { DMMF } from './dmmf-types'
import { Dictionary, keyBy } from './utils/common'

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
  constructor({ datamodel, schema, mappings }: DMMF.Document) {
    this.datamodel = datamodel
    this.schema = schema
    this.mappings = mappings
    this.enumMap = this.getEnumMap()
    this.queryType = this.getQueryType()
    this.mutationType = this.getMutationType()
    this.schema.outputTypes.push(this.queryType) // create "virtual" query type
    this.schema.outputTypes.push(this.mutationType) // create "virtual" mutation type
    this.modelMap = this.getModelMap()
    this.outputTypes = this.getOutputTypes()

    this.resolveOutputTypes(this.outputTypes)

    this.inputTypes = this.schema.inputTypes
    this.resolveInputTypes(this.inputTypes)
    this.inputTypeMap = this.getInputTypeMap()
    this.resolveFieldArgumentTypes(this.outputTypes, this.inputTypeMap)

    this.outputTypeMap = this.getMergedOutputTypeMap()

    // needed as references are not kept
    this.queryType = this.outputTypeMap.Query
    this.mutationType = this.outputTypeMap.Mutation
    this.outputTypes = this.outputTypes
  }
  public getField(fieldName: string) {
    return (
      // TODO: create lookup table for Query and Mutation
      this.queryType.fields.find(f => f.name === fieldName) || this.mutationType.fields.find(f => f.name === fieldName)
    )
  }
  protected outputTypeToMergedOutputType = (outputType: DMMF.OutputType): DMMF.OutputType => {
    const model = this.modelMap[outputType.name]
    return {
      ...outputType,
      isEmbedded: model ? model.isEmbedded : false,
      fields: outputType.fields,
    }
  }
  protected resolveOutputTypes(types: DMMF.OutputType[]) {
    for (const typeA of types) {
      for (const fieldA of typeA.fields) {
        for (const typeB of types) {
          if (typeof fieldA.outputType.type === 'string') {
            if (fieldA.outputType.type === typeB.name) {
              fieldA.outputType.type = typeB
            } else if (this.enumMap[fieldA.outputType.type]) {
              fieldA.outputType.type = this.enumMap[fieldA.outputType.type]
            }
          }
        }
      }
    }
  }
  protected resolveInputTypes(types: DMMF.InputType[]) {
    for (const typeA of types) {
      for (const fieldA of typeA.fields) {
        for (const typeB of types) {
          fieldA.inputType.forEach((inputType, index) => {
            if (typeof inputType.type === 'string') {
              if (inputType.type === typeB.name) {
                fieldA.inputType[index].type = typeB
              } else if (this.enumMap[inputType.type]) {
                fieldA.inputType[index].type = this.enumMap[inputType.type]
              }
            }
          })
        }
      }
    }
  }
  protected resolveFieldArgumentTypes(types: DMMF.OutputType[], inputTypeMap: Dictionary<DMMF.InputType>) {
    for (const type of types) {
      for (const field of type.fields) {
        for (const arg of field.args) {
          arg.inputType.forEach((t, index) => {
            if (typeof t.type === 'string') {
              if (inputTypeMap[t.type]) {
                arg.inputType[index].type = inputTypeMap[t.type]
              } else if (this.enumMap[t.type]) {
                arg.inputType[index].type = this.enumMap[t.type]
              }
            }
          })
        }
      }
    }
  }
  protected getQueryType(): DMMF.OutputType {
    return this.schema.outputTypes.find(t => t.name === 'Query')!
  }
  protected getMutationType(): DMMF.OutputType {
    return this.schema.outputTypes.find(t => t.name === 'Mutation')!
  }
  protected getOutputTypes(): DMMF.OutputType[] {
    return this.schema.outputTypes.map(this.outputTypeToMergedOutputType)
  }
  protected getEnumMap(): Dictionary<DMMF.Enum> {
    return keyBy(this.schema.enums, e => e.name)
  }
  protected getModelMap(): Dictionary<DMMF.Model> {
    return keyBy(this.datamodel.models, m => m.name)
  }
  protected getMergedOutputTypeMap(): Dictionary<DMMF.OutputType> {
    return keyBy(this.outputTypes, t => t.name)
  }
  protected getInputTypeMap(): Dictionary<DMMF.InputType> {
    return keyBy(this.schema.inputTypes, t => t.name)
  }
}
