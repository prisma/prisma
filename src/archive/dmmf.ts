export const dmmf = {
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
          },
          {
            name: 'id',
            type: 'ID',
          },
          {
            name: 'id_not',
            type: 'ID',
          },
          {
            name: 'id_in',
            type: 'ID',
          },
          {
            name: 'id_not_in',
            type: 'ID',
          },
          {
            name: 'id_lt',
            type: 'ID',
          },
          {
            name: 'id_lte',
            type: 'ID',
          },
          {
            name: 'id_gt',
            type: 'ID',
          },
          {
            name: 'id_gte',
            type: 'ID',
          },
          {
            name: 'id_contains',
            type: 'ID',
          },
          {
            name: 'id_not_contains',
            type: 'ID',
          },
          {
            name: 'id_starts_with',
            type: 'ID',
          },
          {
            name: 'id_not_starts_with',
            type: 'ID',
          },
          {
            name: 'id_ends_with',
            type: 'ID',
          },
          {
            name: 'id_not_ends_with',
            type: 'ID',
          },
          {
            name: 'name',
            type: 'String',
          },
          {
            name: 'name_not',
            type: 'String',
          },
          {
            name: 'name_in',
            type: 'String',
          },
          {
            name: 'name_not_in',
            type: 'String',
          },
          {
            name: 'name_lt',
            type: 'String',
          },
          {
            name: 'name_lte',
            type: 'String',
          },
          {
            name: 'name_gt',
            type: 'String',
          },
          {
            name: 'name_gte',
            type: 'String',
          },
          {
            name: 'name_contains',
            type: 'String',
          },
          {
            name: 'name_not_contains',
            type: 'String',
          },
          {
            name: 'name_starts_with',
            type: 'String',
          },
          {
            name: 'name_not_starts_with',
            type: 'String',
          },
          {
            name: 'name_ends_with',
            type: 'String',
          },
          {
            name: 'name_not_ends_with',
            type: 'String',
          },
          {
            name: 'posts_some',
            type: 'PostWhereInput',
          },
        ],
      },
      {
        name: 'UserOrderByInput',
        args: [
          {
            name: 'id_ASC',
            type: 'UserOrderByInput',
          },
          {
            name: 'id_DESC',
            type: 'UserOrderByInput',
          },
          {
            name: 'name_ASC',
            type: 'UserOrderByInput',
          },
          {
            name: 'name_DESC',
            type: 'UserOrderByInput',
          },
        ],
      },
      {
        name: 'PostWhereInput',
        args: [
          {
            name: 'AND',
            type: 'PostWhereInput',
          },
          {
            name: 'id',
            type: 'ID',
          },
          {
            name: 'id_not',
            type: 'ID',
          },
          {
            name: 'id_in',
            type: 'ID',
          },
          {
            name: 'id_not_in',
            type: 'ID',
          },
          {
            name: 'id_lt',
            type: 'ID',
          },
          {
            name: 'id_lte',
            type: 'ID',
          },
          {
            name: 'id_gt',
            type: 'ID',
          },
          {
            name: 'id_gte',
            type: 'ID',
          },
          {
            name: 'id_contains',
            type: 'ID',
          },
          {
            name: 'id_not_contains',
            type: 'ID',
          },
          {
            name: 'id_starts_with',
            type: 'ID',
          },
          {
            name: 'id_not_starts_with',
            type: 'ID',
          },
          {
            name: 'id_ends_with',
            type: 'ID',
          },
          {
            name: 'id_not_ends_with',
            type: 'ID',
          },
          {
            name: 'title',
            type: 'String',
          },
          {
            name: 'title_not',
            type: 'String',
          },
          {
            name: 'title_in',
            type: 'String',
          },
          {
            name: 'title_not_in',
            type: 'String',
          },
          {
            name: 'title_lt',
            type: 'String',
          },
          {
            name: 'title_lte',
            type: 'String',
          },
          {
            name: 'title_gt',
            type: 'String',
          },
          {
            name: 'title_gte',
            type: 'String',
          },
          {
            name: 'title_contains',
            type: 'String',
          },
          {
            name: 'title_not_contains',
            type: 'String',
          },
          {
            name: 'title_starts_with',
            type: 'String',
          },
          {
            name: 'title_not_starts_with',
            type: 'String',
          },
          {
            name: 'title_ends_with',
            type: 'String',
          },
          {
            name: 'title_not_ends_with',
            type: 'String',
          },
          {
            name: 'content',
            type: 'String',
          },
          {
            name: 'content_not',
            type: 'String',
          },
          {
            name: 'content_in',
            type: 'String',
          },
          {
            name: 'content_not_in',
            type: 'String',
          },
          {
            name: 'content_lt',
            type: 'String',
          },
          {
            name: 'content_lte',
            type: 'String',
          },
          {
            name: 'content_gt',
            type: 'String',
          },
          {
            name: 'content_gte',
            type: 'String',
          },
          {
            name: 'content_contains',
            type: 'String',
          },
          {
            name: 'content_not_contains',
            type: 'String',
          },
          {
            name: 'content_starts_with',
            type: 'String',
          },
          {
            name: 'content_not_starts_with',
            type: 'String',
          },
          {
            name: 'content_ends_with',
            type: 'String',
          },
          {
            name: 'content_not_ends_with',
            type: 'String',
          },
          {
            name: 'author',
            type: 'UserWhereInput',
          },
        ],
      },
      {
        name: 'PostOrderByInput',
        args: [
          {
            name: 'id_ASC',
            type: 'PostOrderByInput',
          },
          {
            name: 'id_DESC',
            type: 'PostOrderByInput',
          },
          {
            name: 'title_ASC',
            type: 'PostOrderByInput',
          },
          {
            name: 'title_DESC',
            type: 'PostOrderByInput',
          },
          {
            name: 'content_ASC',
            type: 'PostOrderByInput',
          },
          {
            name: 'content_DESC',
            type: 'PostOrderByInput',
          },
        ],
      },
      {
        name: 'UserWhereUniqueInput',
        args: [
          {
            name: 'id',
            type: 'ID',
          },
        ],
      },
      {
        name: 'PostWhereUniqueInput',
        args: [
          {
            name: 'id',
            type: 'ID',
          },
        ],
      },
      {
        name: 'UserCreateInput',
        args: [
          {
            name: 'id',
            type: 'ID',
          },
          {
            name: 'name',
            type: 'String',
          },
          {
            name: 'strings',
            type: 'UserCreatestringsInput',
          },
          {
            name: 'posts',
            type: 'PostCreateManyWithoutAuthorInput',
          },
        ],
      },
      {
        name: 'PostCreateInput',
        args: [
          {
            name: 'id',
            type: 'ID',
          },
          {
            name: 'title',
            type: 'String',
          },
          {
            name: 'content',
            type: 'String',
          },
          {
            name: 'author',
            type: 'UserCreateOneWithoutPostsInput',
          },
        ],
      },
      {
        name: 'UserUpdateInput',
        args: [
          {
            name: 'name',
            type: 'String',
          },
          {
            name: 'strings',
            type: 'UserUpdatestringsInput',
          },
          {
            name: 'posts',
            type: 'PostUpdateManyWithoutAuthorInput',
          },
        ],
      },
      {
        name: 'PostUpdateInput',
        args: [
          {
            name: 'title',
            type: 'String',
          },
          {
            name: 'content',
            type: 'String',
          },
          {
            name: 'author',
            type: 'UserUpdateOneRequiredWithoutPostsInput',
          },
        ],
      },
      {
        name: 'UserUpdateManyMutationInput',
        args: [
          {
            name: 'name',
            type: 'String',
          },
          {
            name: 'strings',
            type: 'UserUpdatestringsInput',
          },
        ],
      },
      {
        name: 'PostUpdateManyMutationInput',
        args: [
          {
            name: 'title',
            type: 'String',
          },
          {
            name: 'content',
            type: 'String',
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
          },
          {
            name: 'name',
            type: 'String',
            arity: 'required',
          },
          {
            name: 'strings',
            arity: 'list',
          },
          {
            name: 'posts',
            type: 'Post',
            arity: 'optional',
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
            type: 'User',
            arity: 'required',
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
          },
          {
            name: 'edges',
            type: 'UserEdge',
            arity: 'list',
          },
          {
            name: 'aggregate',
            type: 'AggregateUser',
            arity: 'required',
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
          },
          {
            name: 'edges',
            type: 'PostEdge',
            arity: 'list',
          },
          {
            name: 'aggregate',
            type: 'AggregatePost',
            arity: 'required',
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
