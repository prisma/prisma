import { DMMF } from './dmmf-types'
import { keyBy, isScalar, Dictionary } from './utils'
import { performance } from 'perf_hooks'

export class DMMFClass implements DMMF.Document {
  datamodel: DMMF.Datamodel
  schema: DMMF.Schema
  mappings: DMMF.Mapping[]
  queryType: DMMF.MergedOutputType
  mutationType: DMMF.MergedOutputType
  outputTypes: DMMF.MergedOutputType[]
  outputTypeMap: Dictionary<DMMF.MergedOutputType> = {}
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

    this.resolveRelations(this.outputTypes)

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
  protected resolveRelations(types: DMMF.MergedOutputType[]) {
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

const queryToSchemaField = (q: DMMF.Query): DMMF.MergedSchemaField => ({
  name: q.name,
  args: q.args,
  arity: q.output.arity,
  type: q.output.name,
  kind: 'relation',
})

const dmmfDocument: DMMF.Document = {
  datamodel: {
    models: [
      {
        name: 'User',
        isEmbedded: false,
        isEnum: false,
        dbName: '',
        fields: [
          {
            kind: 'scalar',
            name: 'id',
            arity: 'required',
            isUnique: true,
            isId: true,
            type: 'ID',
          },
          {
            kind: 'scalar',
            name: 'name',
            arity: 'required',
            isUnique: false,
            isId: false,
            type: 'String',
          },
          {
            kind: 'scalar',
            name: 'strings',
            arity: 'list',
            isUnique: false,
            isId: false,
            type: 'String',
          },
          {
            kind: 'relation',
            name: 'posts',
            arity: 'list',
            isUnique: false,
            isId: false,
            type: 'Post',
          },
        ],
      },
      {
        name: 'Post',
        isEmbedded: false,
        isEnum: false,
        dbName: '',
        fields: [
          {
            kind: 'scalar',
            name: 'id',
            arity: 'required',
            isUnique: true,
            isId: true,
            type: 'ID',
          },
          {
            kind: 'scalar',
            name: 'title',
            arity: 'required',
            isUnique: false,
            isId: false,
            type: 'String',
          },
          {
            kind: 'scalar',
            name: 'content',
            arity: 'required',
            isUnique: false,
            isId: false,
            type: 'String',
          },
          {
            kind: 'relation',
            name: 'author',
            arity: 'required',
            isUnique: false,
            isId: false,
            type: 'User',
          },
        ],
      },
    ],
  },
  schema: {
    queries: [
      {
        name: 'users',
        args: [
          {
            name: 'where',
            type: 'UserWhereInput',
            arity: 'optional',
          },
          {
            name: 'orderBy',
            type: 'UserOrderByInput',
            arity: 'optional',
          },
          {
            name: 'skip',
            type: 'Int',
            arity: 'optional',
          },
          {
            name: 'after',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'before',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'first',
            type: 'Int',
            arity: 'optional',
          },
          {
            name: 'last',
            type: 'Int',
            arity: 'optional',
          },
        ],
        output: {
          name: 'User',
          arity: 'list',
        },
      },
      {
        name: 'posts',
        args: [
          {
            name: 'where',
            type: 'PostWhereInput',
            arity: 'optional',
          },
          {
            name: 'orderBy',
            type: 'PostOrderByInput',
            arity: 'optional',
          },
          {
            name: 'skip',
            type: 'Int',
            arity: 'optional',
          },
          {
            name: 'after',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'before',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'first',
            type: 'Int',
            arity: 'optional',
          },
          {
            name: 'last',
            type: 'Int',
            arity: 'optional',
          },
        ],
        output: {
          name: 'Post',
          arity: 'list',
        },
      },
      {
        name: 'user',
        args: [
          {
            name: 'where',
            type: 'UserWhereUniqueInput',
            arity: 'required',
          },
        ],
        output: {
          name: 'User',
          arity: 'optional',
        },
      },
      {
        name: 'post',
        args: [
          {
            name: 'where',
            type: 'PostWhereUniqueInput',
            arity: 'required',
          },
        ],
        output: {
          name: 'Post',
          arity: 'optional',
        },
      },
      {
        name: 'usersConnection',
        args: [
          {
            name: 'where',
            type: 'UserWhereInput',
            arity: 'optional',
          },
          {
            name: 'orderBy',
            type: 'UserOrderByInput',
            arity: 'optional',
          },
          {
            name: 'skip',
            type: 'Int',
            arity: 'optional',
          },
          {
            name: 'after',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'before',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'first',
            type: 'Int',
            arity: 'optional',
          },
          {
            name: 'last',
            type: 'Int',
            arity: 'optional',
          },
        ],
        output: {
          name: 'UserConnection',
          arity: 'required',
        },
      },
      {
        name: 'postsConnection',
        args: [
          {
            name: 'where',
            type: 'PostWhereInput',
            arity: 'optional',
          },
          {
            name: 'orderBy',
            type: 'PostOrderByInput',
            arity: 'optional',
          },
          {
            name: 'skip',
            type: 'Int',
            arity: 'optional',
          },
          {
            name: 'after',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'before',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'first',
            type: 'Int',
            arity: 'optional',
          },
          {
            name: 'last',
            type: 'Int',
            arity: 'optional',
          },
        ],
        output: {
          name: 'PostConnection',
          arity: 'required',
        },
      },
      {
        name: 'node',
        args: [
          {
            name: 'id',
            type: 'ID',
            arity: 'required',
          },
        ],
        output: {
          name: 'Node',
          arity: 'optional',
        },
      },
    ],
    mutations: [
      {
        name: 'createUser',
        args: [
          {
            name: 'data',
            type: 'UserCreateInput',
            arity: 'required',
          },
        ],
        output: {
          name: 'User',
          arity: 'required',
        },
      },
      {
        name: 'createPost',
        args: [
          {
            name: 'data',
            type: 'PostCreateInput',
            arity: 'required',
          },
        ],
        output: {
          name: 'Post',
          arity: 'required',
        },
      },
      {
        name: 'updateUser',
        args: [
          {
            name: 'data',
            type: 'UserUpdateInput',
            arity: 'required',
          },
          {
            name: 'where',
            type: 'UserWhereUniqueInput',
            arity: 'required',
          },
        ],
        output: {
          name: 'User',
          arity: 'optional',
        },
      },
      {
        name: 'updatePost',
        args: [
          {
            name: 'data',
            type: 'PostUpdateInput',
            arity: 'required',
          },
          {
            name: 'where',
            type: 'PostWhereUniqueInput',
            arity: 'required',
          },
        ],
        output: {
          name: 'Post',
          arity: 'optional',
        },
      },
      {
        name: 'deleteUser',
        args: [
          {
            name: 'where',
            type: 'UserWhereUniqueInput',
            arity: 'required',
          },
        ],
        output: {
          name: 'User',
          arity: 'optional',
        },
      },
      {
        name: 'deletePost',
        args: [
          {
            name: 'where',
            type: 'PostWhereUniqueInput',
            arity: 'required',
          },
        ],
        output: {
          name: 'Post',
          arity: 'optional',
        },
      },
      {
        name: 'upsertUser',
        args: [
          {
            name: 'where',
            type: 'UserWhereUniqueInput',
            arity: 'required',
          },
          {
            name: 'create',
            type: 'UserCreateInput',
            arity: 'required',
          },
          {
            name: 'update',
            type: 'UserUpdateInput',
            arity: 'required',
          },
        ],
        output: {
          name: 'User',
          arity: 'required',
        },
      },
      {
        name: 'upsertPost',
        args: [
          {
            name: 'where',
            type: 'PostWhereUniqueInput',
            arity: 'required',
          },
          {
            name: 'create',
            type: 'PostCreateInput',
            arity: 'required',
          },
          {
            name: 'update',
            type: 'PostUpdateInput',
            arity: 'required',
          },
        ],
        output: {
          name: 'Post',
          arity: 'required',
        },
      },
      {
        name: 'updateManyUsers',
        args: [
          {
            name: 'data',
            type: 'UserUpdateManyMutationInput',
            arity: 'required',
          },
          {
            name: 'where',
            type: 'UserWhereInput',
            arity: 'optional',
          },
        ],
        output: {
          name: 'BatchPayload',
          arity: 'required',
        },
      },
      {
        name: 'updateManyPosts',
        args: [
          {
            name: 'data',
            type: 'PostUpdateManyMutationInput',
            arity: 'required',
          },
          {
            name: 'where',
            type: 'PostWhereInput',
            arity: 'optional',
          },
        ],
        output: {
          name: 'BatchPayload',
          arity: 'required',
        },
      },
      {
        name: 'deleteManyUsers',
        args: [
          {
            name: 'where',
            type: 'UserWhereInput',
            arity: 'optional',
          },
        ],
        output: {
          name: 'BatchPayload',
          arity: 'required',
        },
      },
      {
        name: 'deleteManyPosts',
        args: [
          {
            name: 'where',
            type: 'PostWhereInput',
            arity: 'optional',
          },
        ],
        output: {
          name: 'BatchPayload',
          arity: 'required',
        },
      },
    ],
    inputTypes: [
      {
        name: 'UserWhereInput',
        args: [
          {
            name: 'AND',
            type: 'UserWhereInput',
            arity: 'optional',
          },
          {
            name: 'id',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_not',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_in',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_not_in',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_lt',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_lte',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_gt',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_gte',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_contains',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_not_contains',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_starts_with',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_not_starts_with',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_ends_with',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_not_ends_with',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'name',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'name_not',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'name_in',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'name_not_in',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'name_lt',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'name_lte',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'name_gt',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'name_gte',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'name_contains',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'name_not_contains',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'name_starts_with',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'name_not_starts_with',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'name_ends_with',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'name_not_ends_with',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'posts_some',
            type: 'PostWhereInput',
            arity: 'optional',
          },
        ],
      },
      {
        name: 'UserOrderByInput',
        args: [
          {
            name: 'id_ASC',
            type: 'UserOrderByInput',
            arity: 'optional',
          },
          {
            name: 'id_DESC',
            type: 'UserOrderByInput',
            arity: 'optional',
          },
          {
            name: 'name_ASC',
            type: 'UserOrderByInput',
            arity: 'optional',
          },
          {
            name: 'name_DESC',
            type: 'UserOrderByInput',
            arity: 'optional',
          },
        ],
      },
      {
        name: 'PostWhereInput',
        args: [
          {
            name: 'AND',
            type: 'PostWhereInput',
            arity: 'optional',
          },
          {
            name: 'id',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_not',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_in',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_not_in',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_lt',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_lte',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_gt',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_gte',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_contains',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_not_contains',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_starts_with',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_not_starts_with',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_ends_with',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'id_not_ends_with',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'title',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'title_not',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'title_in',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'title_not_in',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'title_lt',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'title_lte',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'title_gt',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'title_gte',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'title_contains',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'title_not_contains',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'title_starts_with',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'title_not_starts_with',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'title_ends_with',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'title_not_ends_with',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'content',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'content_not',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'content_in',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'content_not_in',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'content_lt',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'content_lte',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'content_gt',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'content_gte',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'content_contains',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'content_not_contains',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'content_starts_with',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'content_not_starts_with',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'content_ends_with',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'content_not_ends_with',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'author',
            type: 'UserWhereInput',
            arity: 'optional',
          },
        ],
      },
      {
        name: 'PostOrderByInput',
        args: [
          {
            name: 'id_ASC',
            type: 'PostOrderByInput',
            arity: 'optional',
          },
          {
            name: 'id_DESC',
            type: 'PostOrderByInput',
            arity: 'optional',
          },
          {
            name: 'title_ASC',
            type: 'PostOrderByInput',
            arity: 'optional',
          },
          {
            name: 'title_DESC',
            type: 'PostOrderByInput',
            arity: 'optional',
          },
          {
            name: 'content_ASC',
            type: 'PostOrderByInput',
            arity: 'optional',
          },
          {
            name: 'content_DESC',
            type: 'PostOrderByInput',
            arity: 'optional',
          },
        ],
      },
      {
        name: 'UserWhereUniqueInput',
        args: [
          {
            name: 'id',
            type: 'ID',
            arity: 'optional',
          },
        ],
      },
      {
        name: 'PostWhereUniqueInput',
        args: [
          {
            name: 'id',
            type: 'ID',
            arity: 'optional',
          },
        ],
      },
      {
        name: 'UserCreateInput',
        args: [
          {
            name: 'id',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'name',
            type: 'String',
            arity: 'required',
          },
          {
            name: 'strings',
            type: 'UserCreatestringsInput',
            arity: 'optional',
          },
          {
            name: 'posts',
            type: 'PostCreateManyWithoutAuthorInput',
            arity: 'optional',
          },
        ],
      },
      {
        name: 'PostCreateInput',
        args: [
          {
            name: 'id',
            type: 'ID',
            arity: 'optional',
          },
          {
            name: 'title',
            type: 'String',
            arity: 'required',
          },
          {
            name: 'content',
            type: 'String',
            arity: 'required',
          },
          {
            name: 'author',
            type: 'UserCreateOneWithoutPostsInput',
            arity: 'required',
          },
        ],
      },
      {
        name: 'UserUpdateInput',
        args: [
          {
            name: 'name',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'strings',
            type: 'UserUpdatestringsInput',
            arity: 'optional',
          },
          {
            name: 'posts',
            type: 'PostUpdateManyWithoutAuthorInput',
            arity: 'optional',
          },
        ],
      },
      {
        name: 'PostUpdateInput',
        args: [
          {
            name: 'title',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'content',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'author',
            type: 'UserUpdateOneRequiredWithoutPostsInput',
            arity: 'optional',
          },
        ],
      },
      {
        name: 'UserUpdateManyMutationInput',
        args: [
          {
            name: 'name',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'strings',
            type: 'UserUpdatestringsInput',
            arity: 'optional',
          },
        ],
      },
      {
        name: 'PostUpdateManyMutationInput',
        args: [
          {
            name: 'title',
            type: 'String',
            arity: 'optional',
          },
          {
            name: 'content',
            type: 'String',
            arity: 'optional',
          },
        ],
      },
    ],
    outputTypes: [
      {
        name: 'User',
        fields: [
          {
            name: 'id',
            type: 'ID',
            arity: 'required',
            args: [],
          },
          {
            name: 'name',
            type: 'String',
            arity: 'required',
            args: [],
          },
          {
            name: 'strings',
            type: 'String',
            arity: 'list',
            args: [],
          },
          {
            name: 'posts',
            type: 'Post',
            arity: 'optional',
            args: [
              {
                name: 'where',
                type: 'PostWhereInput',
                arity: 'optional',
              },
              {
                name: 'orderBy',
                type: 'PostOrderByInput',
                arity: 'optional',
              },
              {
                name: 'skip',
                type: 'Int',
                arity: 'optional',
              },
              {
                name: 'after',
                type: 'String',
                arity: 'optional',
              },
              {
                name: 'before',
                type: 'String',
                arity: 'optional',
              },
              {
                name: 'first',
                type: 'Int',
                arity: 'optional',
              },
              {
                name: 'last',
                type: 'Int',
                arity: 'optional',
              },
            ],
          },
        ],
      },
      {
        name: 'Post',
        fields: [
          {
            name: 'id',
            type: 'ID',
            arity: 'required',
            args: [],
          },
          {
            name: 'title',
            type: 'String',
            arity: 'required',
            args: [],
          },
          {
            name: 'content',
            type: 'String',
            arity: 'required',
            args: [],
          },
          {
            name: 'author',
            type: 'User',
            arity: 'required',
            args: [],
          },
        ],
      },
      {
        name: 'UserConnection',
        fields: [
          {
            name: 'pageInfo',
            type: 'PageInfo',
            arity: 'required',
            args: [],
          },
          {
            name: 'edges',
            type: 'UserEdge',
            arity: 'list',
            args: [],
          },
          {
            name: 'aggregate',
            type: 'AggregateUser',
            arity: 'required',
            args: [],
          },
        ],
      },
      {
        name: 'PostConnection',
        fields: [
          {
            name: 'pageInfo',
            type: 'PageInfo',
            arity: 'required',
            args: [],
          },
          {
            name: 'edges',
            type: 'PostEdge',
            arity: 'list',
            args: [],
          },
          {
            name: 'aggregate',
            type: 'AggregatePost',
            arity: 'required',
            args: [],
          },
        ],
      },
      {
        name: 'Node',
        fields: [
          {
            name: 'id',
            type: 'ID',
            arity: 'required',
            args: [],
          },
        ],
      },
      {
        name: 'BatchPayload',
        fields: [
          {
            name: 'count',
            type: 'Long',
            arity: 'required',
            args: [],
          },
        ],
      },
    ],
  },
  mappings: [
    {
      model: 'User',
      findOne: 'user',
      findMany: 'users',
      create: 'createUser',
      update: 'updateUser',
      updateMany: 'updateManyUser',
      upsert: 'upsertUser',
      delete: 'deleteUser',
      deleteMany: 'deleteManyUser',
    },
    {
      model: 'Post',
      findOne: 'post',
      findMany: 'posts',
      create: 'createPost',
      update: 'updatePost',
      updateMany: 'updateManyPost',
      upsert: 'upsertPost',
      delete: 'deletePost',
      deleteMany: 'deleteManyPost',
    },
  ],
}

const before = performance.now()
export const dmmf = new DMMFClass(dmmfDocument)
debugger
const after = performance.now()
console.log(`Took ${after - before}ms to build the dmmf`)
