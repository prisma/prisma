import { DMMF as ExternalDMMF } from '@prisma/generator-helper'
import pluralize from 'pluralize'
import { DMMF } from './dmmf-types'
import { lowerCase } from './utils/common'
import { uniqueBy } from './utils/uniqueBy'

function transformFieldKind(model: ExternalDMMF.Model): DMMF.Model {
  return {
    ...model,
    fields: model.fields.map((field) => ({
      ...field,
      kind: field.kind === 'relation' ? ('object' as any) : field.kind,
    })),
    uniqueFields: model.uniqueFields.map((field) => ({
      ...field,
      kind: field.kind === 'relation' ? ('object' as any) : field.kind,
    })),
  }
}

function transformDatamodel(datamodel: ExternalDMMF.Datamodel): DMMF.Datamodel {
  return {
    enums: datamodel.enums.map((enumValue) => ({
      ...enumValue,
      values: enumValue.values.map((v) => v.name),
    })),
    models: datamodel.models.map(transformFieldKind),
  }
}

/**
 * Turns type: string into type: string[] for all args in order to support union input types
 * @param document
 */
export function externalToInternalDmmf(
  document: ExternalDMMF.Document,
): DMMF.Document {
  const datamodel = transformDatamodel(document.datamodel)
  return {
    datamodel,
    mappings: getMappings(document.mappings, datamodel),
    schema: transformSchema(document.schema),
  }
}

function transformSchema(schema: ExternalDMMF.Schema): DMMF.Schema {
  return {
    enums: schema.enums,
    inputTypes: schema.inputTypes.map((t) => ({
      ...t,
      fields: uniqueBy(transformArgs(t.fields), (f) => f.name),
    })),
    outputTypes: schema.outputTypes.map((o) => ({
      ...o,
      fields: o.fields.map((f) => ({ ...f, args: transformArgs(f.args) })),
    })),
  }
}

function transformArgs(args: ExternalDMMF.SchemaArg[]): DMMF.SchemaArg[] {
  return args.map(transformArg)
}

function fixOrderByEnum(arg: ExternalDMMF.SchemaArg): ExternalDMMF.SchemaArg {
  if (arg.name === 'orderBy' && arg.inputType.type.endsWith('OrderByInput')) {
    return {
      name: arg.name,
      inputType: {
        isList: arg.inputType.isList,
        isRequired: arg.inputType.isRequired,
        isNullable: arg.inputType.isNullable,
        type: arg.inputType.type,
        kind: 'object',
      },
    }
  }
  return arg
}

function transformArg(argBefore: ExternalDMMF.SchemaArg): DMMF.SchemaArg {
  const arg = fixOrderByEnum(argBefore)
  return {
    name: arg.name,
    inputType: [arg.inputType],
  }
}

function getMappings(
  mappings: ExternalDMMF.Mapping[],
  datamodel: DMMF.Datamodel,
): DMMF.Mapping[] {
  return mappings
    .filter((mapping) => {
      const model = datamodel.models.find((m) => m.name === mapping.model)
      if (!model) {
        throw new Error(`Mapping without model ${mapping.model}`)
      }
      return model.fields.some((f) => f.kind !== 'object')
    })
    .map((mapping: any) => ({
      model: mapping.model,
      plural: pluralize(lowerCase(mapping.model)),
      findOne: mapping.findSingle || mapping.findOne,
      findMany: mapping.findMany,
      create: mapping.createOne || mapping.createSingle || mapping.create,
      delete: mapping.deleteOne || mapping.deleteSingle || mapping.delete,
      update: mapping.updateOne || mapping.updateSingle || mapping.update,
      deleteMany: mapping.deleteMany,
      updateMany: mapping.updateMany,
      upsert: mapping.upsertOne || mapping.upsertSingle || mapping.upsert,
      aggregate: mapping.aggregate,
    }))
}
