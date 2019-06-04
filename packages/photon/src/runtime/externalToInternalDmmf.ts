import { capitalize, lowerCase, plural } from 'prisma-datamodel'
import { DMMF, ExternalDMMF } from './dmmf-types'
import { keyBy } from './utils/common'

function transformFieldKind(model: ExternalDMMF.Model): DMMF.Model {
  return {
    ...model,
    fields: model.fields.map(field => ({ ...field, kind: field.kind === 'relation' ? 'object' : field.kind })),
  }
}

function transformDatamodel(datamodel: ExternalDMMF.Datamodel): DMMF.Datamodel {
  return {
    enums: datamodel.enums,
    models: datamodel.models.map(transformFieldKind),
  }
}

/**
 * Turns type: string into type: string[] for all args in order to support union input types
 * @param document
 */
export function externalToInternalDmmf(document: ExternalDMMF.Document): DMMF.Document {
  return {
    datamodel: transformDatamodel(document.datamodel),
    mappings: getMappings(document),
    schema: transformSchema(document.schema),
  }
}

function transformSchema(schema: ExternalDMMF.Schema): DMMF.Schema {
  return {
    enums: schema.enums,
    inputTypes: schema.inputTypes.map(t => ({ ...t, fields: transformArgs(t.fields) })),
    outputTypes: schema.outputTypes.map(o => ({
      ...o,
      fields: o.fields.map(f => ({ ...f, args: transformArgs(f.args) })),
    })),
  }
}

function transformArgs(args: ExternalDMMF.SchemaArg[]): DMMF.SchemaArg[] {
  return args.map(transformArg)
}

function transformArg(arg: ExternalDMMF.SchemaArg): DMMF.SchemaArg {
  return {
    name: arg.name,
    inputType: [arg.inputType],
  }
}

function getMappings(dmmf: ExternalDMMF.Document): DMMF.Mapping[] {
  return dmmf.datamodel.models.map(model => {
    const modelName = capitalize(model.name)

    const query = dmmf.schema.outputTypes.find(t => t.name === 'Query')
    const mutation = dmmf.schema.outputTypes.find(t => t.name === 'Mutation')

    const queryFields = keyBy(query.fields, f => f.name)
    const mutationFields = keyBy(mutation.fields, f => f.name)

    const mapping: DMMF.Mapping = {
      model: modelName,
    }
    for (const action in DMMF.ModelAction) {
      const queryName = getQueryName(action as DMMF.ModelAction, modelName)
      if (queryFields[queryName] || mutationFields[queryName]) {
        mapping[action] = queryName
      } else {
        mapping[action] = null
      }
    }

    return mapping
  })
}

function getQueryName(action: DMMF.ModelAction, modelName: string) {
  switch (action) {
    case DMMF.ModelAction.findOne:
      return lowerCase(modelName)
    case DMMF.ModelAction.findMany:
      return plural(lowerCase(modelName))
    case DMMF.ModelAction.create:
      return `create${modelName}`
    case DMMF.ModelAction.update:
      return `update${modelName}`
    case DMMF.ModelAction.updateMany:
      return `updateMany${plural(modelName)}`
    case DMMF.ModelAction.upsert:
      return `upsert${modelName}`
    case DMMF.ModelAction.delete:
      return `delete${modelName}`
    case DMMF.ModelAction.deleteMany:
      return `deleteMany${plural(modelName)}`
  }
}
