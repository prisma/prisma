import { DMMF } from './dmmf-types'
import { keyBy, isScalar, Dictionary, destroyCircular, uniqBy } from './utils/common'

export class DMMFClass implements DMMF.Document {
  datamodel: DMMF.Datamodel
  schema: DMMF.Schema
  mappings: DMMF.Mapping[]
  queryType: DMMF.MergedOutputType
  mutationType: DMMF.MergedOutputType
  outputTypes: DMMF.MergedOutputType[]
  outputTypeMap: Dictionary<DMMF.MergedOutputType> = {}
  inputTypes: DMMF.InputType[]
  inputTypeMap: Dictionary<DMMF.InputType>
  enumMap: Dictionary<DMMF.Enum>
  modelMap: Dictionary<DMMF.Model>
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
    this.queryType = this.outputTypeMap['Query']
    this.mutationType = this.outputTypeMap['Mutation']
    this.outputTypes = uniqBy(this.outputTypes, o => o.name).filter(o => {
      return !o.name.endsWith('PreviousValues') && !o.name.includes('Subscription')
    })
    this.inputTypes = uniqBy(this.inputTypes, o => o.name).filter(
      o => !o.name.includes('Subscription') && o.name !== 'MutationType',
    )
  }
  protected outputTypeToMergedOutputType = (outputType: DMMF.OutputType): DMMF.MergedOutputType => {
    const model = this.modelMap[outputType.name]
    return {
      ...outputType,
      isEmbedded: model ? model.isEmbedded : false,
      fields: outputType.fields,
    }
  }
  protected resolveOutputTypes(types: DMMF.MergedOutputType[]) {
    for (const typeA of types) {
      for (const fieldA of typeA.fields) {
        for (const typeB of types) {
          if (typeof fieldA.type === 'string') {
            if (fieldA.type === typeB.name) {
              fieldA.type = typeB
            } else if (this.enumMap[fieldA.type]) {
              fieldA.type = this.enumMap[fieldA.type]
            }
          }
        }
      }
    }
  }
  protected resolveInputTypes(types: DMMF.InputType[]) {
    for (const typeA of types) {
      for (const fieldA of typeA.args) {
        for (const typeB of types) {
          if (typeof fieldA.type === 'string') {
            if (fieldA.type === typeB.name) {
              fieldA.type = typeB
            } else if (this.enumMap[fieldA.type]) {
              fieldA.type = this.enumMap[fieldA.type]
            }
          }
        }
      }
    }
  }
  protected resolveFieldArgumentTypes(types: DMMF.MergedOutputType[], inputTypeMap: Dictionary<DMMF.InputType>) {
    for (const type of types) {
      for (const field of type.fields) {
        for (const arg of field.args) {
          if (typeof arg.type === 'string') {
            if (inputTypeMap[arg.type]) {
              arg.type = inputTypeMap[arg.type]
            } else if (this.enumMap[arg.type]) {
              arg.type = this.enumMap[arg.type]
            }
          }
        }
      }
    }
  }
  protected getQueryType(): DMMF.MergedOutputType {
    return {
      name: 'Query',
      fields: this.schema.queries
        .map(queryToSchemaField)
        .filter(f => !f.name.endsWith('Connection') && f.name !== 'Node'),
      isEmbedded: false,
    }
  }
  protected getMutationType(): DMMF.MergedOutputType {
    return {
      name: 'Mutation',
      fields: this.schema.mutations.map(queryToSchemaField),
      isEmbedded: false,
    }
  }
  protected getOutputTypes(): DMMF.MergedOutputType[] {
    return this.schema.outputTypes.map(this.outputTypeToMergedOutputType)
  }
  protected getEnumMap(): Dictionary<DMMF.Enum> {
    return keyBy(this.schema.enums, e => e.name)
  }
  protected getModelMap(): Dictionary<DMMF.Model> {
    return keyBy(this.datamodel.models, m => m.name)
  }
  protected getMergedOutputTypeMap(): Dictionary<DMMF.MergedOutputType> {
    return keyBy(this.outputTypes, t => t.name)
  }
  protected getInputTypeMap(): Dictionary<DMMF.InputType> {
    return keyBy(this.schema.inputTypes, t => t.name)
  }
  public getField(fieldName: string) {
    return (
      // TODO: create lookup table for Query and Mutation
      this.queryType.fields.find(f => f.name === fieldName) || this.mutationType.fields.find(f => f.name === fieldName)
    )
  }
}

const queryToSchemaField = (q: DMMF.Query): DMMF.SchemaField => ({
  name: q.name,
  args: q.args,
  isList: q.output.isList,
  isRequired: q.output.isRequired,
  type: q.output.name,
  kind: 'relation',
})
