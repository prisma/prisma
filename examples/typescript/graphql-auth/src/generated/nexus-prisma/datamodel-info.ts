export default {
  uniqueFieldsByModel: {
    Post: ['id'],
    User: ['id', 'email'],
  },
  schema: {
    __schema: {
      queryType: {
        name: 'Query',
      },
      mutationType: {
        name: 'Mutation',
      },
      subscriptionType: {
        name: 'Subscription',
      },
      types: [
        {
          kind: 'OBJECT',
          name: 'Query',
          description: null,
          fields: [
            {
              name: 'post',
              description: null,
              args: [
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'PostWhereUniqueInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'OBJECT',
                name: 'Post',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'posts',
              description: null,
              args: [
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostWhereInput',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'orderBy',
                  description: null,
                  type: {
                    kind: 'ENUM',
                    name: 'PostOrderByInput',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'skip',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'after',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'before',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'first',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'last',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'LIST',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: 'Post',
                    ofType: null,
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'postsConnection',
              description: null,
              args: [
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostWhereInput',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'orderBy',
                  description: null,
                  type: {
                    kind: 'ENUM',
                    name: 'PostOrderByInput',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'skip',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'after',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'before',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'first',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'last',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'PostConnection',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'user',
              description: null,
              args: [
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'UserWhereUniqueInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'OBJECT',
                name: 'User',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'users',
              description: null,
              args: [
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'INPUT_OBJECT',
                    name: 'UserWhereInput',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'orderBy',
                  description: null,
                  type: {
                    kind: 'ENUM',
                    name: 'UserOrderByInput',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'skip',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'after',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'before',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'first',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'last',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'LIST',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: 'User',
                    ofType: null,
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'usersConnection',
              description: null,
              args: [
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'INPUT_OBJECT',
                    name: 'UserWhereInput',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'orderBy',
                  description: null,
                  type: {
                    kind: 'ENUM',
                    name: 'UserOrderByInput',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'skip',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'after',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'before',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'first',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'last',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'UserConnection',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'node',
              description: null,
              args: [
                {
                  name: 'id',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'SCALAR',
                      name: 'ID',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'INTERFACE',
                name: 'Node',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'PostWhereUniqueInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'id',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'SCALAR',
          name: 'ID',
          description:
            'The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `"4"`) or integer (such as `4`) input value will be accepted as an ID.',
          fields: null,
          inputFields: null,
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: 'Post',
          description: null,
          fields: [
            {
              name: 'id',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'ID',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'createdAt',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'DateTime',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'updatedAt',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'DateTime',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'published',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'Boolean',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'title',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'content',
              description: null,
              args: [],
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'author',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'User',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'SCALAR',
          name: 'DateTime',
          description: null,
          fields: null,
          inputFields: null,
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'SCALAR',
          name: 'Boolean',
          description:
            'The `Boolean` scalar type represents `true` or `false`.',
          fields: null,
          inputFields: null,
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'SCALAR',
          name: 'String',
          description:
            'The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.',
          fields: null,
          inputFields: null,
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: 'User',
          description: null,
          fields: [
            {
              name: 'id',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'ID',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'email',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'password',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'name',
              description: null,
              args: [],
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'posts',
              description: null,
              args: [
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostWhereInput',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'orderBy',
                  description: null,
                  type: {
                    kind: 'ENUM',
                    name: 'PostOrderByInput',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'skip',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'after',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'before',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'first',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                  defaultValue: null,
                },
                {
                  name: 'last',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: 'Post',
                    ofType: null,
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'PostWhereInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'id',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_not',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'id_not_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'id_lt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_lte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_gt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_gte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_not_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_not_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_not_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'createdAt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'createdAt_not',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'createdAt_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'DateTime',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'createdAt_not_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'DateTime',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'createdAt_lt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'createdAt_lte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'createdAt_gt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'createdAt_gte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'updatedAt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'updatedAt_not',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'updatedAt_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'DateTime',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'updatedAt_not_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'DateTime',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'updatedAt_lt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'updatedAt_lte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'updatedAt_gt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'updatedAt_gte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'published',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'published_not',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_not',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'title_not_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'title_lt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_lte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_gt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_gte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_not_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_not_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_not_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_not',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'content_not_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'content_lt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_lte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_gt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_gte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_not_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_not_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_not_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'author',
              description: null,
              type: {
                kind: 'INPUT_OBJECT',
                name: 'UserWhereInput',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'AND',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostWhereInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'OR',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostWhereInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'NOT',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostWhereInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'UserWhereInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'id',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_not',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'id_not_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'id_lt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_lte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_gt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_gte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_not_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_not_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_not_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'email',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'email_not',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'email_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'email_not_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'email_lt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'email_lte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'email_gt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'email_gte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'email_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'email_not_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'email_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'email_not_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'email_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'email_not_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'password',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'password_not',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'password_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'password_not_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'password_lt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'password_lte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'password_gt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'password_gte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'password_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'password_not_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'password_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'password_not_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'password_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'password_not_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'name',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'name_not',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'name_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'name_not_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'name_lt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'name_lte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'name_gt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'name_gte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'name_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'name_not_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'name_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'name_not_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'name_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'name_not_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'posts_every',
              description: null,
              type: {
                kind: 'INPUT_OBJECT',
                name: 'PostWhereInput',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'posts_some',
              description: null,
              type: {
                kind: 'INPUT_OBJECT',
                name: 'PostWhereInput',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'posts_none',
              description: null,
              type: {
                kind: 'INPUT_OBJECT',
                name: 'PostWhereInput',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'AND',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'UserWhereInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'OR',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'UserWhereInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'NOT',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'UserWhereInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'ENUM',
          name: 'PostOrderByInput',
          description: null,
          fields: null,
          inputFields: null,
          interfaces: null,
          enumValues: [
            {
              name: 'id_ASC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'id_DESC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'createdAt_ASC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'createdAt_DESC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'updatedAt_ASC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'updatedAt_DESC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'published_ASC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'published_DESC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'title_ASC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'title_DESC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'content_ASC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'content_DESC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          possibleTypes: null,
        },
        {
          kind: 'SCALAR',
          name: 'Int',
          description:
            'The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1. ',
          fields: null,
          inputFields: null,
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: 'PostConnection',
          description: null,
          fields: [
            {
              name: 'pageInfo',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'PageInfo',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'edges',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'LIST',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: 'PostEdge',
                    ofType: null,
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'aggregate',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'AggregatePost',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: 'PageInfo',
          description: null,
          fields: [
            {
              name: 'hasNextPage',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'Boolean',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'hasPreviousPage',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'Boolean',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'startCursor',
              description: null,
              args: [],
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'endCursor',
              description: null,
              args: [],
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: 'PostEdge',
          description: null,
          fields: [
            {
              name: 'node',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'Post',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'cursor',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: 'AggregatePost',
          description: null,
          fields: [
            {
              name: 'count',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'Int',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'UserWhereUniqueInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'id',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'email',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'ENUM',
          name: 'UserOrderByInput',
          description: null,
          fields: null,
          inputFields: null,
          interfaces: null,
          enumValues: [
            {
              name: 'id_ASC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'id_DESC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'email_ASC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'email_DESC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'password_ASC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'password_DESC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'name_ASC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'name_DESC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'createdAt_ASC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'createdAt_DESC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'updatedAt_ASC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'updatedAt_DESC',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: 'UserConnection',
          description: null,
          fields: [
            {
              name: 'pageInfo',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'PageInfo',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'edges',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'LIST',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: 'UserEdge',
                    ofType: null,
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'aggregate',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'AggregateUser',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: 'UserEdge',
          description: null,
          fields: [
            {
              name: 'node',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'User',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'cursor',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: 'AggregateUser',
          description: null,
          fields: [
            {
              name: 'count',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'Int',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INTERFACE',
          name: 'Node',
          description: null,
          fields: [
            {
              name: 'id',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'ID',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: null,
          enumValues: null,
          possibleTypes: [],
        },
        {
          kind: 'OBJECT',
          name: 'Mutation',
          description: null,
          fields: [
            {
              name: 'createPost',
              description: null,
              args: [
                {
                  name: 'data',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'PostCreateInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'Post',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'updatePost',
              description: null,
              args: [
                {
                  name: 'data',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'PostUpdateInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'PostWhereUniqueInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'OBJECT',
                name: 'Post',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'updateManyPosts',
              description: null,
              args: [
                {
                  name: 'data',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'PostUpdateManyMutationInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostWhereInput',
                    ofType: null,
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'BatchPayload',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'upsertPost',
              description: null,
              args: [
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'PostWhereUniqueInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
                {
                  name: 'create',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'PostCreateInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
                {
                  name: 'update',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'PostUpdateInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'Post',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'deletePost',
              description: null,
              args: [
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'PostWhereUniqueInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'OBJECT',
                name: 'Post',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'deleteManyPosts',
              description: null,
              args: [
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostWhereInput',
                    ofType: null,
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'BatchPayload',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'createUser',
              description: null,
              args: [
                {
                  name: 'data',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'UserCreateInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'User',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'updateUser',
              description: null,
              args: [
                {
                  name: 'data',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'UserUpdateInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'UserWhereUniqueInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'OBJECT',
                name: 'User',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'updateManyUsers',
              description: null,
              args: [
                {
                  name: 'data',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'UserUpdateManyMutationInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'INPUT_OBJECT',
                    name: 'UserWhereInput',
                    ofType: null,
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'BatchPayload',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'upsertUser',
              description: null,
              args: [
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'UserWhereUniqueInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
                {
                  name: 'create',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'UserCreateInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
                {
                  name: 'update',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'UserUpdateInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'User',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'deleteUser',
              description: null,
              args: [
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'INPUT_OBJECT',
                      name: 'UserWhereUniqueInput',
                      ofType: null,
                    },
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'OBJECT',
                name: 'User',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'deleteManyUsers',
              description: null,
              args: [
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'INPUT_OBJECT',
                    name: 'UserWhereInput',
                    ofType: null,
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: 'BatchPayload',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'PostCreateInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'published',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title',
              description: null,
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
            {
              name: 'content',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'author',
              description: null,
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'INPUT_OBJECT',
                  name: 'UserCreateOneWithoutPostsInput',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'UserCreateOneWithoutPostsInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'create',
              description: null,
              type: {
                kind: 'INPUT_OBJECT',
                name: 'UserCreateWithoutPostsInput',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'connect',
              description: null,
              type: {
                kind: 'INPUT_OBJECT',
                name: 'UserWhereUniqueInput',
                ofType: null,
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'UserCreateWithoutPostsInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'email',
              description: null,
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
            {
              name: 'password',
              description: null,
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
            {
              name: 'name',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'PostUpdateInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'published',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'author',
              description: null,
              type: {
                kind: 'INPUT_OBJECT',
                name: 'UserUpdateOneRequiredWithoutPostsInput',
                ofType: null,
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'UserUpdateOneRequiredWithoutPostsInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'create',
              description: null,
              type: {
                kind: 'INPUT_OBJECT',
                name: 'UserCreateWithoutPostsInput',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'update',
              description: null,
              type: {
                kind: 'INPUT_OBJECT',
                name: 'UserUpdateWithoutPostsDataInput',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'upsert',
              description: null,
              type: {
                kind: 'INPUT_OBJECT',
                name: 'UserUpsertWithoutPostsInput',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'connect',
              description: null,
              type: {
                kind: 'INPUT_OBJECT',
                name: 'UserWhereUniqueInput',
                ofType: null,
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'UserUpdateWithoutPostsDataInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'email',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'password',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'name',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'UserUpsertWithoutPostsInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'update',
              description: null,
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'INPUT_OBJECT',
                  name: 'UserUpdateWithoutPostsDataInput',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
            {
              name: 'create',
              description: null,
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'INPUT_OBJECT',
                  name: 'UserCreateWithoutPostsInput',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'PostUpdateManyMutationInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'published',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: 'BatchPayload',
          description: null,
          fields: [
            {
              name: 'count',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'Long',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'SCALAR',
          name: 'Long',
          description: null,
          fields: null,
          inputFields: null,
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'UserCreateInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'email',
              description: null,
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
            {
              name: 'password',
              description: null,
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
            {
              name: 'name',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'posts',
              description: null,
              type: {
                kind: 'INPUT_OBJECT',
                name: 'PostCreateManyWithoutAuthorInput',
                ofType: null,
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'PostCreateManyWithoutAuthorInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'create',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostCreateWithoutAuthorInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'connect',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostWhereUniqueInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'PostCreateWithoutAuthorInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'published',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title',
              description: null,
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
            {
              name: 'content',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'UserUpdateInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'email',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'password',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'name',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'posts',
              description: null,
              type: {
                kind: 'INPUT_OBJECT',
                name: 'PostUpdateManyWithoutAuthorInput',
                ofType: null,
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'PostUpdateManyWithoutAuthorInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'create',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostCreateWithoutAuthorInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'delete',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostWhereUniqueInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'connect',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostWhereUniqueInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'set',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostWhereUniqueInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'disconnect',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostWhereUniqueInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'update',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostUpdateWithWhereUniqueWithoutAuthorInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'upsert',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostUpsertWithWhereUniqueWithoutAuthorInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'deleteMany',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostScalarWhereInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'updateMany',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostUpdateManyWithWhereNestedInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'PostUpdateWithWhereUniqueWithoutAuthorInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'where',
              description: null,
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'INPUT_OBJECT',
                  name: 'PostWhereUniqueInput',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
            {
              name: 'data',
              description: null,
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'INPUT_OBJECT',
                  name: 'PostUpdateWithoutAuthorDataInput',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'PostUpdateWithoutAuthorDataInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'published',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'PostUpsertWithWhereUniqueWithoutAuthorInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'where',
              description: null,
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'INPUT_OBJECT',
                  name: 'PostWhereUniqueInput',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
            {
              name: 'update',
              description: null,
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'INPUT_OBJECT',
                  name: 'PostUpdateWithoutAuthorDataInput',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
            {
              name: 'create',
              description: null,
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'INPUT_OBJECT',
                  name: 'PostCreateWithoutAuthorInput',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'PostScalarWhereInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'id',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_not',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'id_not_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'id_lt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_lte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_gt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_gte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_not_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_not_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'id_not_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'createdAt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'createdAt_not',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'createdAt_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'DateTime',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'createdAt_not_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'DateTime',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'createdAt_lt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'createdAt_lte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'createdAt_gt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'createdAt_gte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'updatedAt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'updatedAt_not',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'updatedAt_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'DateTime',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'updatedAt_not_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'DateTime',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'updatedAt_lt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'updatedAt_lte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'updatedAt_gt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'updatedAt_gte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'DateTime',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'published',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'published_not',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_not',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'title_not_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'title_lt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_lte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_gt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_gte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_not_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_not_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title_not_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_not',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'content_not_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'content_lt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_lte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_gt',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_gte',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_not_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_not_starts_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content_not_ends_with',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'AND',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostScalarWhereInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'OR',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostScalarWhereInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'NOT',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostScalarWhereInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'PostUpdateManyWithWhereNestedInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'where',
              description: null,
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'INPUT_OBJECT',
                  name: 'PostScalarWhereInput',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
            {
              name: 'data',
              description: null,
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'INPUT_OBJECT',
                  name: 'PostUpdateManyDataInput',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'PostUpdateManyDataInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'published',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'title',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'content',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'UserUpdateManyMutationInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'email',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'password',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'name',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: 'Subscription',
          description: null,
          fields: [
            {
              name: 'post',
              description: null,
              args: [
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostSubscriptionWhereInput',
                    ofType: null,
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'OBJECT',
                name: 'PostSubscriptionPayload',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'user',
              description: null,
              args: [
                {
                  name: 'where',
                  description: null,
                  type: {
                    kind: 'INPUT_OBJECT',
                    name: 'UserSubscriptionWhereInput',
                    ofType: null,
                  },
                  defaultValue: null,
                },
              ],
              type: {
                kind: 'OBJECT',
                name: 'UserSubscriptionPayload',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'PostSubscriptionWhereInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'mutation_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'ENUM',
                    name: 'MutationType',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'updatedFields_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'updatedFields_contains_every',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'updatedFields_contains_some',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'node',
              description: null,
              type: {
                kind: 'INPUT_OBJECT',
                name: 'PostWhereInput',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'AND',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostSubscriptionWhereInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'OR',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostSubscriptionWhereInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'NOT',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'PostSubscriptionWhereInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'ENUM',
          name: 'MutationType',
          description: null,
          fields: null,
          inputFields: null,
          interfaces: null,
          enumValues: [
            {
              name: 'CREATED',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'UPDATED',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'DELETED',
              description: null,
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: 'PostSubscriptionPayload',
          description: null,
          fields: [
            {
              name: 'mutation',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'ENUM',
                  name: 'MutationType',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'node',
              description: null,
              args: [],
              type: {
                kind: 'OBJECT',
                name: 'Post',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'updatedFields',
              description: null,
              args: [],
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'previousValues',
              description: null,
              args: [],
              type: {
                kind: 'OBJECT',
                name: 'PostPreviousValues',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: 'PostPreviousValues',
          description: null,
          fields: [
            {
              name: 'id',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'ID',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'createdAt',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'DateTime',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'updatedAt',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'DateTime',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'published',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'Boolean',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'title',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'content',
              description: null,
              args: [],
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'UserSubscriptionWhereInput',
          description: null,
          fields: null,
          inputFields: [
            {
              name: 'mutation_in',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'ENUM',
                    name: 'MutationType',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'updatedFields_contains',
              description: null,
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'updatedFields_contains_every',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'updatedFields_contains_some',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'node',
              description: null,
              type: {
                kind: 'INPUT_OBJECT',
                name: 'UserWhereInput',
                ofType: null,
              },
              defaultValue: null,
            },
            {
              name: 'AND',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'UserSubscriptionWhereInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'OR',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'UserSubscriptionWhereInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
            {
              name: 'NOT',
              description: null,
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'UserSubscriptionWhereInput',
                    ofType: null,
                  },
                },
              },
              defaultValue: null,
            },
          ],
          interfaces: null,
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: 'UserSubscriptionPayload',
          description: null,
          fields: [
            {
              name: 'mutation',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'ENUM',
                  name: 'MutationType',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'node',
              description: null,
              args: [],
              type: {
                kind: 'OBJECT',
                name: 'User',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'updatedFields',
              description: null,
              args: [],
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'previousValues',
              description: null,
              args: [],
              type: {
                kind: 'OBJECT',
                name: 'UserPreviousValues',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: 'UserPreviousValues',
          description: null,
          fields: [
            {
              name: 'id',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'ID',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'email',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'password',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'name',
              description: null,
              args: [],
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: '__Schema',
          description:
            'A GraphQL Schema defines the capabilities of a GraphQL server. It exposes all available types and directives on the server, as well as the entry points for query, mutation, and subscription operations.',
          fields: [
            {
              name: 'types',
              description: 'A list of all types supported by this server.',
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'LIST',
                  name: null,
                  ofType: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'OBJECT',
                      name: '__Type',
                      ofType: null,
                    },
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'queryType',
              description: 'The type that query operations will be rooted at.',
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: '__Type',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'mutationType',
              description:
                'If this server supports mutation, the type that mutation operations will be rooted at.',
              args: [],
              type: {
                kind: 'OBJECT',
                name: '__Type',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'subscriptionType',
              description:
                'If this server support subscription, the type that subscription operations will be rooted at.',
              args: [],
              type: {
                kind: 'OBJECT',
                name: '__Type',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'directives',
              description: 'A list of all directives supported by this server.',
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'LIST',
                  name: null,
                  ofType: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'OBJECT',
                      name: '__Directive',
                      ofType: null,
                    },
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: '__Type',
          description:
            'The fundamental unit of any GraphQL Schema is the type. There are many kinds of types in GraphQL as represented by the `__TypeKind` enum.\n\nDepending on the kind of a type, certain fields describe information about that type. Scalar types provide no information beyond a name and description, while Enum types provide their values. Object and Interface types provide the fields they describe. Abstract types, Union and Interface, provide the Object types possible at runtime. List and NonNull types compose other types.',
          fields: [
            {
              name: 'kind',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'ENUM',
                  name: '__TypeKind',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'name',
              description: null,
              args: [],
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'description',
              description: null,
              args: [],
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'fields',
              description: null,
              args: [
                {
                  name: 'includeDeprecated',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Boolean',
                    ofType: null,
                  },
                  defaultValue: 'false',
                },
              ],
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: '__Field',
                    ofType: null,
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'interfaces',
              description: null,
              args: [],
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: '__Type',
                    ofType: null,
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'possibleTypes',
              description: null,
              args: [],
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: '__Type',
                    ofType: null,
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'enumValues',
              description: null,
              args: [
                {
                  name: 'includeDeprecated',
                  description: null,
                  type: {
                    kind: 'SCALAR',
                    name: 'Boolean',
                    ofType: null,
                  },
                  defaultValue: 'false',
                },
              ],
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: '__EnumValue',
                    ofType: null,
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'inputFields',
              description: null,
              args: [],
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: '__InputValue',
                    ofType: null,
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'ofType',
              description: null,
              args: [],
              type: {
                kind: 'OBJECT',
                name: '__Type',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'ENUM',
          name: '__TypeKind',
          description:
            'An enum describing what kind of type a given `__Type` is.',
          fields: null,
          inputFields: null,
          interfaces: null,
          enumValues: [
            {
              name: 'SCALAR',
              description: 'Indicates this type is a scalar.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'OBJECT',
              description:
                'Indicates this type is an object. `fields` and `interfaces` are valid fields.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'INTERFACE',
              description:
                'Indicates this type is an interface. `fields` and `possibleTypes` are valid fields.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'UNION',
              description:
                'Indicates this type is a union. `possibleTypes` is a valid field.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'ENUM',
              description:
                'Indicates this type is an enum. `enumValues` is a valid field.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'INPUT_OBJECT',
              description:
                'Indicates this type is an input object. `inputFields` is a valid field.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'LIST',
              description:
                'Indicates this type is a list. `ofType` is a valid field.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'NON_NULL',
              description:
                'Indicates this type is a non-null. `ofType` is a valid field.',
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: '__Field',
          description:
            'Object and Interface types are described by a list of Fields, each of which has a name, potentially a list of arguments, and a return type.',
          fields: [
            {
              name: 'name',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'description',
              description: null,
              args: [],
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'args',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'LIST',
                  name: null,
                  ofType: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'OBJECT',
                      name: '__InputValue',
                      ofType: null,
                    },
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'type',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: '__Type',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'isDeprecated',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'Boolean',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'deprecationReason',
              description: null,
              args: [],
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: '__InputValue',
          description:
            'Arguments provided to Fields or Directives and the input fields of an InputObject are represented as Input Values which describe their type and optionally a default value.',
          fields: [
            {
              name: 'name',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'description',
              description: null,
              args: [],
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'type',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: '__Type',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'defaultValue',
              description:
                'A GraphQL-formatted string representing the default value for this input value.',
              args: [],
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: '__EnumValue',
          description:
            'One possible value for a given Enum. Enum values are unique values, not a placeholder for a string or numeric value. However an Enum value is returned in a JSON response as a string.',
          fields: [
            {
              name: 'name',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'description',
              description: null,
              args: [],
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'isDeprecated',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'Boolean',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'deprecationReason',
              description: null,
              args: [],
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'OBJECT',
          name: '__Directive',
          description:
            "A Directive provides a way to describe alternate runtime execution and type validation behavior in a GraphQL document.\n\nIn some cases, you need to provide options to alter GraphQL's execution behavior in ways field arguments will not suffice, such as conditionally including or skipping a field. Directives provide this by describing additional information to the executor.",
          fields: [
            {
              name: 'name',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'description',
              description: null,
              args: [],
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'locations',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'LIST',
                  name: null,
                  ofType: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'ENUM',
                      name: '__DirectiveLocation',
                      ofType: null,
                    },
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'args',
              description: null,
              args: [],
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'LIST',
                  name: null,
                  ofType: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'OBJECT',
                      name: '__InputValue',
                      ofType: null,
                    },
                  },
                },
              },
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null,
        },
        {
          kind: 'ENUM',
          name: '__DirectiveLocation',
          description:
            'A Directive can be adjacent to many parts of the GraphQL language, a __DirectiveLocation describes one such possible adjacencies.',
          fields: null,
          inputFields: null,
          interfaces: null,
          enumValues: [
            {
              name: 'QUERY',
              description: 'Location adjacent to a query operation.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'MUTATION',
              description: 'Location adjacent to a mutation operation.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'SUBSCRIPTION',
              description: 'Location adjacent to a subscription operation.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'FIELD',
              description: 'Location adjacent to a field.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'FRAGMENT_DEFINITION',
              description: 'Location adjacent to a fragment definition.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'FRAGMENT_SPREAD',
              description: 'Location adjacent to a fragment spread.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'INLINE_FRAGMENT',
              description: 'Location adjacent to an inline fragment.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'VARIABLE_DEFINITION',
              description: 'Location adjacent to a variable definition.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'SCHEMA',
              description: 'Location adjacent to a schema definition.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'SCALAR',
              description: 'Location adjacent to a scalar definition.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'OBJECT',
              description: 'Location adjacent to an object type definition.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'FIELD_DEFINITION',
              description: 'Location adjacent to a field definition.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'ARGUMENT_DEFINITION',
              description: 'Location adjacent to an argument definition.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'INTERFACE',
              description: 'Location adjacent to an interface definition.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'UNION',
              description: 'Location adjacent to a union definition.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'ENUM',
              description: 'Location adjacent to an enum definition.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'ENUM_VALUE',
              description: 'Location adjacent to an enum value definition.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'INPUT_OBJECT',
              description:
                'Location adjacent to an input object type definition.',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'INPUT_FIELD_DEFINITION',
              description:
                'Location adjacent to an input object field definition.',
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          possibleTypes: null,
        },
      ],
      directives: [
        {
          name: 'include',
          description:
            'Directs the executor to include this field or fragment only when the `if` argument is true.',
          locations: ['FIELD', 'FRAGMENT_SPREAD', 'INLINE_FRAGMENT'],
          args: [
            {
              name: 'if',
              description: 'Included when true.',
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'Boolean',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
          ],
        },
        {
          name: 'skip',
          description:
            'Directs the executor to skip this field or fragment when the `if` argument is true.',
          locations: ['FIELD', 'FRAGMENT_SPREAD', 'INLINE_FRAGMENT'],
          args: [
            {
              name: 'if',
              description: 'Skipped when true.',
              type: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'Boolean',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
          ],
        },
        {
          name: 'deprecated',
          description:
            'Marks an element of a GraphQL schema as no longer supported.',
          locations: ['FIELD_DEFINITION', 'ENUM_VALUE'],
          args: [
            {
              name: 'reason',
              description:
                'Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data. Formatted using the Markdown syntax (as specified by [CommonMark](https://commonmark.org/).',
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: '"No longer supported"',
            },
          ],
        },
      ],
    },
  },
}
