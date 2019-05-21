import { DMMF } from './dmmf-types'

/**
 * Turns type: string into type: string[] for all args in order to support union input types
 * @param document
 */
export function getUnionDocument(document: DMMF.Document<DMMF.RawSchemaArg>): DMMF.Document<DMMF.SchemaArg> {
  return {
    datamodel: document.datamodel,
    mappings: document.mappings,
    schema: transformSchema(document.schema),
  }
}

function transformSchema(schema: DMMF.Schema<DMMF.RawSchemaArg>): DMMF.Schema<DMMF.SchemaArg> {
  return {
    enums: schema.enums,
    queries: schema.queries.map(q => ({ ...q, args: transformArgs(q.args) })),
    mutations: schema.mutations.map(q => ({ ...q, args: transformArgs(q.args) })),
    inputTypes: schema.inputTypes.map(t => ({ ...t, args: transformArgs(t.args) })),
    outputTypes: schema.outputTypes.map(o => ({
      ...o,
      fields: o.fields.map(f => ({ ...f, type: f.type as string, args: transformArgs(f.args) })),
    })),
  }
}

function transformArgs(args: DMMF.RawSchemaArg[]): DMMF.SchemaArg[] {
  return args.map(transformArg)
}

function transformArg(arg: DMMF.RawSchemaArg): DMMF.SchemaArg {
  return {
    ...arg,
    type: [arg.type],
  }
}
