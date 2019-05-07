import { DMMF } from './dmmf-types'
import { keyBy, isScalar, Dictionary, destroyCircular } from './utils/common'
import { performance } from 'perf_hooks'
import { dmmfDocument } from './example-dmmf'

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
  modelMap: Dictionary<DMMF.Model>
  constructor({ datamodel, schema, mappings }: DMMF.Document) {
    this.datamodel = datamodel
    this.schema = schema
    this.mappings = mappings
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
  }
  protected outputTypeToMergedOutputType = (outputType: DMMF.OutputType): DMMF.MergedOutputType => {
    const model = this.modelMap[outputType.name]
    return {
      ...outputType,
      isEmbedded: model ? model.isEmbedded : false,
      isEnum: model ? model.isEmbedded : false,
      fields: outputType.fields.map(field => ({
        ...field,
        kind: isScalar(field.type as string) ? 'scalar' : ('relation' as DMMF.FieldKind),
      })),
    }
  }
  protected resolveOutputTypes(types: DMMF.MergedOutputType[]) {
    for (const typeA of types) {
      for (const fieldA of typeA.fields) {
        for (const typeB of types) {
          if (typeof fieldA.type === 'string' && fieldA.type === typeB.name) {
            fieldA.type = typeB
          }
        }
      }
    }
  }
  protected resolveInputTypes(types: DMMF.InputType[]) {
    for (const typeA of types) {
      for (const fieldA of typeA.args) {
        for (const typeB of types) {
          if (typeof fieldA.type === 'string' && fieldA.type === typeB.name) {
            ;(typeB as any).toJSON = function() {
              const withoutCircular = destroyCircular(this)
              return JSON.stringify(withoutCircular)
            }
            fieldA.type = typeB
          }
        }
      }
    }
  }
  protected resolveFieldArgumentTypes(types: DMMF.MergedOutputType[], inputTypeMap: Dictionary<DMMF.InputType>) {
    for (const type of types) {
      for (const field of type.fields) {
        for (const arg of field.args) {
          if (typeof arg.type === 'string' && inputTypeMap[arg.type]) {
            arg.type = inputTypeMap[arg.type]
          }
        }
      }
    }
  }
  protected getQueryType(): DMMF.MergedOutputType {
    return {
      name: 'Query',
      fields: this.schema.queries.map(queryToSchemaField),
      isEmbedded: false,
      isEnum: false,
    }
  }
  protected getMutationType(): DMMF.MergedOutputType {
    return {
      name: 'Mutation',
      fields: this.schema.mutations.map(queryToSchemaField),
      isEmbedded: false,
      isEnum: false,
    }
  }
  protected getOutputTypes(): DMMF.MergedOutputType[] {
    return this.schema.outputTypes.map(this.outputTypeToMergedOutputType)
  }
  protected getModelMap(): { [modelName: string]: DMMF.Model } {
    return keyBy(this.datamodel.models, m => m.name)
  }
  protected getMergedOutputTypeMap(): { [typeName: string]: DMMF.MergedOutputType } {
    return keyBy(this.outputTypes, t => t.name)
  }
  protected getInputTypeMap(): { [typeName: string]: DMMF.InputType } {
    return keyBy(this.schema.inputTypes, t => t.name)
  }
}

const queryToSchemaField = (q: DMMF.Query): DMMF.SchemaField => ({
  name: q.name,
  args: q.args,
  isList: q.output.isList,
  isRequired: q.output.isRequired,
  type: q.output.name,
  isScalar: false,
})

const before = performance.now()
export const dmmf = new DMMFClass(dmmfDocument)
debugger
const after = performance.now()
console.log(`Took ${after - before}ms to build the dmmf`)
