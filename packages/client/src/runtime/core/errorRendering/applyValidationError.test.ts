import chalk from 'chalk'

import { Writer } from '../../../generation/ts-builders/Writer'
import { JsArgs } from '../types/JsApi'
import { ValidationError } from '../types/ValidationError'
import { applyValidationError } from './applyValidationError'
import { buildArgumentsRenderingTree } from './ArgumentsRenderingTree'

const renderError = (error: ValidationError, args: JsArgs) => {
  const argsTree = buildArgumentsRenderingTree(args)
  applyValidationError(error, argsTree)

  const disabledChalk = new chalk.Instance({ level: 0 })
  const context = { chalk: disabledChalk }
  const argsStr = new Writer(0, context).write(argsTree).toString()
  const message = argsTree.renderAllMessages(disabledChalk)

  return `${argsStr}\n\n${message}`
}

const PostOutputDescription = {
  name: 'Post',
  fields: [
    { name: 'id', typeName: 'string', isRelation: false },
    { name: 'title', typeName: 'string', isRelation: false },
    { name: 'comments', typeName: 'Comment', isRelation: true },
  ],
}

describe('includeAndSelect', () => {
  test('top level', () => {
    expect(
      renderError(
        { kind: 'IncludeAndSelect', selectionPath: [] },
        {
          data: { foo: 'bar' },
          include: {},
          select: {},
        },
      ),
    ).toMatchInlineSnapshot(`
      {
        data: {
          foo: "bar"
        },
        include: {},
        ~~~~~~~
        select: {}
        ~~~~~~
      }

      Please either use \`include\` or \`select\`, but not both at the same time.
    `)
  })

  test('deep', () => {
    expect(
      renderError(
        { kind: 'IncludeAndSelect', selectionPath: ['posts', 'likes'] },
        {
          include: {
            posts: {
              where: { published: true },
              select: {
                likes: {
                  select: {},
                  include: {},
                },
              },
            },
          },
        },
      ),
    ).toMatchInlineSnapshot(`
      {
        include: {
          posts: {
            where: {
              published: true
            },
            select: {
              likes: {
                select: {},
                ~~~~~~
                include: {}
                ~~~~~~~
              }
            }
          }
        }
      }

      Please either use \`include\` or \`select\`, but not both at the same time.
    `)
  })
})

describe('includeOnScalar', () => {
  test('top level - no type description', () => {
    expect(
      renderError(
        { kind: 'IncludeOnScalar', selectionPath: ['id'] },
        {
          data: { foo: 'bar' },
          include: {
            id: true,
          },
        },
      ),
    ).toMatchInlineSnapshot(`
      {
        data: {
          foo: "bar"
        },
        include: {
          id: true
          ~~
        }
      }

      Invalid scalar field \`id\` for include statement.
      Note, that include statements only accept relation fields.
    `)
  })

  test('top level - with type descriptions', () => {
    expect(
      renderError(
        {
          kind: 'IncludeOnScalar',
          selectionPath: ['id'],
          outputType: {
            name: 'User',
            fields: [
              { name: 'id', typeName: 'Int', isRelation: false },
              { name: 'name', typeName: 'String', isRelation: false },
              { name: 'posts', typeName: 'Post', isRelation: true },
            ],
          },
        },
        {
          data: { foo: 'bar' },
          include: {
            id: true,
          },
        },
      ),
    ).toMatchInlineSnapshot(`
      {
        data: {
          foo: "bar"
        },
        include: {
          id: true,
          ~~
      ?   posts?: true
        }
      }

      Invalid scalar field \`id\` for include statement on model User. Available options are listed in green.
      Note, that include statements only accept relation fields.
    `)
  })

  test('nested - no type description', () => {
    expect(
      renderError(
        { kind: 'IncludeOnScalar', selectionPath: ['posts', 'id'] },
        {
          data: { foo: 'bar' },
          include: {
            posts: {
              include: {
                id: true,
              },
            },
          },
        },
      ),
    ).toMatchInlineSnapshot(`
      {
        data: {
          foo: "bar"
        },
        include: {
          posts: {
            include: {
              id: true
              ~~
            }
          }
        }
      }

      Invalid scalar field \`id\` for include statement.
      Note, that include statements only accept relation fields.
    `)
  })

  test('nested - with type descriptions', () => {
    expect(
      renderError(
        {
          kind: 'IncludeOnScalar',
          selectionPath: ['posts', 'id'],
          outputType: {
            name: 'Post',
            fields: [
              { name: 'id', typeName: 'Int', isRelation: false },
              { name: 'title', typeName: 'String', isRelation: false },
              { name: 'likes', typeName: 'Like', isRelation: true },
            ],
          },
        },
        {
          data: { foo: 'bar' },
          include: {
            posts: {
              include: {
                id: true,
              },
            },
          },
        },
      ),
    ).toMatchInlineSnapshot(`
      {
        data: {
          foo: "bar"
        },
        include: {
          posts: {
            include: {
              id: true,
              ~~
      ?       likes?: true
            }
          }
        }
      }

      Invalid scalar field \`id\` for include statement on model Post. Available options are listed in green.
      Note, that include statements only accept relation fields.
    `)
  })
})

describe('EmptySelection', () => {
  test('top level', () => {
    expect(
      renderError(
        {
          kind: 'EmptySelection',
          selectionPath: [],
          outputType: PostOutputDescription,
        },
        { where: { published: true }, select: {} },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
          published: true
        },
        select: {
      ?   id?: true,
      ?   title?: true,
      ?   comments?: true
        }
      }

      The \`select\` statement for type Post must not be empty. Available options are listed in green.
    `)
  })

  test('top level with falsy values', () => {
    expect(
      renderError(
        {
          kind: 'EmptySelection',
          selectionPath: [],
          outputType: PostOutputDescription,
        },
        { where: { published: true }, select: { id: false } },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
          published: true
        },
        select: {
      ?   id?: true,
      ?   title?: true,
      ?   comments?: true
        }
      }

      The \`select\` statement for type Post needs at least one truthy value.
    `)
  })

  test('nested', () => {
    expect(
      renderError(
        {
          kind: 'EmptySelection',
          selectionPath: ['users', 'posts'],
          outputType: PostOutputDescription,
        },
        { select: { users: { include: { posts: { select: {} } } } } },
      ),
    ).toMatchInlineSnapshot(`
      {
        select: {
          users: {
            include: {
              posts: {
                select: {
      ?           id?: true,
      ?           title?: true,
      ?           comments?: true
                }
              }
            }
          }
        }
      }

      The \`select\` statement for type Post must not be empty. Available options are listed in green.
    `)
  })
})

describe('UnknownSelectionField', () => {
  test('top level select', () => {
    expect(
      renderError(
        {
          kind: 'UnknownSelectionField',
          selectionPath: ['notThere'],
          outputType: PostOutputDescription,
        },
        { select: { notThere: true } },
      ),
    ).toMatchInlineSnapshot(`
      {
        select: {
          notThere: true,
          ~~~~~~~~
      ?   id?: true,
      ?   title?: true,
      ?   comments?: true
        }
      }

      Unknown field \`notThere\` for select statement on model Post. Available options are listed in green.
    `)
  })

  test('top level include', () => {
    expect(
      renderError(
        {
          kind: 'UnknownSelectionField',
          selectionPath: ['notThere'],
          outputType: PostOutputDescription,
        },
        { include: { notThere: true } },
      ),
    ).toMatchInlineSnapshot(`
      {
        include: {
          notThere: true,
          ~~~~~~~~
      ?   id?: true,
      ?   title?: true,
      ?   comments?: true
        }
      }

      Unknown field \`notThere\` for include statement on model Post. Available options are listed in green.
    `)
  })

  test('nested select', () => {
    expect(
      renderError(
        {
          kind: 'UnknownSelectionField',
          selectionPath: ['users', 'posts', 'notThere'],
          outputType: PostOutputDescription,
        },
        { select: { users: { select: { posts: { select: { notThere: true } } } } } },
      ),
    ).toMatchInlineSnapshot(`
      {
        select: {
          users: {
            select: {
              posts: {
                select: {
                  notThere: true,
                  ~~~~~~~~
      ?           id?: true,
      ?           title?: true,
      ?           comments?: true
                }
              }
            }
          }
        }
      }

      Unknown field \`notThere\` for select statement on model Post. Available options are listed in green.
    `)
  })

  test('nested level include', () => {
    expect(
      renderError(
        {
          kind: 'UnknownSelectionField',
          selectionPath: ['users', 'posts', 'notThere'],
          outputType: PostOutputDescription,
        },
        { select: { users: { include: { posts: { include: { notThere: true } } } } } },
      ),
    ).toMatchInlineSnapshot(`
      {
        select: {
          users: {
            include: {
              posts: {
                include: {
                  notThere: true,
                  ~~~~~~~~
      ?           id?: true,
      ?           title?: true,
      ?           comments?: true
                }
              }
            }
          }
        }
      }

      Unknown field \`notThere\` for include statement on model Post. Available options are listed in green.
    `)
  })
})

describe('UnknownArgument', () => {
  test('top level with suggestion', () => {
    expect(
      renderError(
        {
          kind: 'UnknownArgument',
          selectionPath: [],
          argumentPath: ['wher'],
          arguments: [
            { name: 'where', typeNames: ['PostWhereInput'] },
            { name: 'orderBy', typeNames: ['PostOrderByWithRelationInput', 'List<PostOrderByWithRelationInput>'] },
            { name: 'take', typeNames: ['Int'] },
          ],
        },
        { wher: { id: 123 } },
      ),
    ).toMatchInlineSnapshot(`
      {
        wher: {
        ~~~~
          id: 123
        },
      ? where?: PostWhereInput,
      ? orderBy?: PostOrderByWithRelationInput | List<PostOrderByWithRelationInput>,
      ? take?: Int
      }

      Unknown argument wher. Did you mean \`where\`? Available options are listed in green.
    `)
  })

  test('top level with no suggestions', () => {
    expect(
      renderError(
        {
          kind: 'UnknownArgument',
          selectionPath: [],
          argumentPath: ['wher'],
          arguments: [],
        },
        { wher: { id: 123 } },
      ),
    ).toMatchInlineSnapshot(`
      {
        wher: {
        ~~~~
          id: 123
        }
      }

      Unknown argument wher.
    `)
  })

  test('top level with large edit distance', () => {
    expect(
      renderError(
        {
          kind: 'UnknownArgument',
          selectionPath: [],
          argumentPath: ['completelyNotThere'],
          arguments: [
            { name: 'where', typeNames: ['PostWhereInput'] },
            { name: 'orderBy', typeNames: ['PostOrderByWithRelationInput', 'List<PostOrderByWithRelationInput>'] },
            { name: 'take', typeNames: ['Int'] },
          ],
        },
        { completelyNotThere: { id: 123 } },
      ),
    ).toMatchInlineSnapshot(`
      {
        completelyNotThere: {
        ~~~~~~~~~~~~~~~~~~
          id: 123
        },
      ? where?: PostWhereInput,
      ? orderBy?: PostOrderByWithRelationInput | List<PostOrderByWithRelationInput>,
      ? take?: Int
      }

      Unknown argument completelyNotThere. Available options are listed in green.
    `)
  })

  test('nested selection', () => {
    expect(
      renderError(
        {
          kind: 'UnknownArgument',
          selectionPath: ['posts', 'comments'],
          argumentPath: ['wherr'],
          arguments: [
            { name: 'where', typeNames: ['CommentWhereInput'] },
            {
              name: 'orderBy',
              typeNames: ['CommentOrderByWithRelationInput', 'List<CommentOrderByWithRelationInput>'],
            },
            { name: 'take', typeNames: ['Int'] },
          ],
        },
        { include: { posts: { include: { comments: { wherr: { upvotes: 0 } } } } } },
      ),
    ).toMatchInlineSnapshot(`
      {
        include: {
          posts: {
            include: {
              comments: {
                wherr: {
                ~~~~~
                  upvotes: 0
                },
      ?         where?: CommentWhereInput,
      ?         orderBy?: CommentOrderByWithRelationInput | List<CommentOrderByWithRelationInput>,
      ?         take?: Int
              }
            }
          }
        }
      }

      Unknown argument wherr. Did you mean \`where\`? Available options are listed in green.
    `)
  })
})

describe('UnknownInputField', () => {
  test('simple', () => {
    expect(
      renderError(
        {
          kind: 'UnknownInputField',
          selectionPath: [],
          argumentPath: ['where', 'upvote'],
          inputType: {
            kind: 'object',
            name: 'PostWhereInput',
            fields: [
              { name: 'id', required: false, typeNames: ['String'] },
              { name: 'name', required: false, typeNames: ['String'] },
              { name: 'upvotes', required: false, typeNames: ['Int', 'IntFilter'] },
            ],
          },
        },
        { where: { upvote: { gt: 0 } } },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
          upvote: {
          ~~~~~~
            gt: 0
          },
      ?   id?: String,
      ?   name?: String,
      ?   upvotes?: Int | IntFilter
        }
      }

      Unknown argument upvote. Did you mean \`upvotes\`? Available options are listed in green.
    `)
  })

  test('simple with large edit distance', () => {
    expect(
      renderError(
        {
          kind: 'UnknownInputField',
          selectionPath: [],
          argumentPath: ['where', 'somethingCompletelyDifferent'],
          inputType: {
            kind: 'object',
            name: 'PostWhereInput',
            fields: [
              { name: 'id', required: false, typeNames: ['String'] },
              { name: 'name', required: false, typeNames: ['String'] },
              { name: 'upvotes', required: false, typeNames: ['Int', 'IntFilter'] },
            ],
          },
        },
        { where: { somethingCompletelyDifferent: { gt: 0 } } },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
          somethingCompletelyDifferent: {
          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            gt: 0
          },
      ?   id?: String,
      ?   name?: String,
      ?   upvotes?: Int | IntFilter
        }
      }

      Unknown argument somethingCompletelyDifferent. Available options are listed in green.
    `)
  })

  test('nested selection', () => {
    expect(
      renderError(
        {
          kind: 'UnknownInputField',
          selectionPath: ['posts'],
          argumentPath: ['where', 'upvote'],
          inputType: {
            kind: 'object',
            name: 'PostWhereInput',
            fields: [
              { name: 'id', required: false, typeNames: ['String'] },
              { name: 'name', required: false, typeNames: ['String'] },
              { name: 'upvotes', required: false, typeNames: ['Int', 'IntFilter'] },
            ],
          },
        },
        { include: { posts: { where: { upvote: { gt: 0 } } } } },
      ),
    ).toMatchInlineSnapshot(`
      {
        include: {
          posts: {
            where: {
              upvote: {
              ~~~~~~
                gt: 0
              },
      ?       id?: String,
      ?       name?: String,
      ?       upvotes?: Int | IntFilter
            }
          }
        }
      }

      Unknown argument upvote. Did you mean \`upvotes\`? Available options are listed in green.
    `)
  })
})

describe('RequiredArgumentMissing', () => {
  test('simple', () => {
    expect(
      renderError(
        {
          kind: 'RequiredArgumentMissing',
          argumentPath: ['where'],
          selectionPath: [],
          inputTypes: [
            {
              kind: 'object',
              name: 'UserWhereInput',
              fields: [
                { name: 'id', typeNames: ['Int'], required: false },
                { name: 'email', typeNames: ['String'], required: false },
              ],
            },
          ],
        },
        {},
      ),
    ).toMatchInlineSnapshot(`
      {
      + where: {
      +   id: Int,
      +   email: String
      + }
      }

      Argument where is missing.
    `)
  })

  test('field with multiple types', () => {
    expect(
      renderError(
        {
          kind: 'RequiredArgumentMissing',
          argumentPath: ['where'],
          selectionPath: [],
          inputTypes: [
            {
              kind: 'object',
              name: 'UserWhereInput',
              fields: [{ name: 'id', typeNames: ['Int', 'String'], required: false }],
            },
          ],
        },
        {},
      ),
    ).toMatchInlineSnapshot(`
      {
      + where: {
      +   id: Int | String
      + }
      }

      Argument where is missing.
    `)
  })

  test('multiple input types', () => {
    expect(
      renderError(
        {
          kind: 'RequiredArgumentMissing',
          argumentPath: ['where'],
          selectionPath: [],
          inputTypes: [
            {
              kind: 'object',
              name: 'UserWhereInput',
              fields: [{ name: 'id', typeNames: ['Int', 'String'], required: false }],
            },

            {
              kind: 'object',
              name: 'UserBetterWhereInput',
              fields: [{ name: 'id', typeNames: ['Int', 'String'], required: false }],
            },
          ],
        },
        {},
      ),
    ).toMatchInlineSnapshot(`
      {
      + where: UserWhereInput | UserBetterWhereInput
      }

      Argument where is missing.
    `)
  })

  test('with list', () => {
    expect(
      renderError(
        {
          kind: 'RequiredArgumentMissing',
          argumentPath: ['data'],
          selectionPath: [],
          inputTypes: [
            {
              kind: 'list',
              elementType: {
                kind: 'object',
                name: 'UserCreateInput',
                fields: [],
              },
            },
          ],
        },
        {},
      ),
    ).toMatchInlineSnapshot(`
      {
      + data: UserCreateInput[]
      }

      Argument data is missing.
    `)
  })

  test('nested argument', () => {
    expect(
      renderError(
        {
          kind: 'RequiredArgumentMissing',
          argumentPath: ['data', 'email'],
          selectionPath: [],
          inputTypes: [
            {
              kind: 'scalar',
              name: 'String',
            },
          ],
        },
        { data: {} },
      ),
    ).toMatchInlineSnapshot(`
      {
        data: {
      +   email: String
        }
      }

      Argument email is missing.
    `)
  })

  test('nested selection', () => {
    expect(
      renderError(
        {
          kind: 'RequiredArgumentMissing',
          argumentPath: ['where'],
          selectionPath: ['user'],
          inputTypes: [
            {
              kind: 'object',
              name: 'UserWhereInput',
              fields: [
                { name: 'id', typeNames: ['Int'], required: false },
                { name: 'email', typeNames: ['String'], required: false },
              ],
            },
          ],
        },
        {
          select: {
            user: {},
          },
        },
      ),
    ).toMatchInlineSnapshot(`
      {
        select: {
          user: {
      +     where: {
      +       id: Int,
      +       email: String
      +     }
          }
        }
      }

      Argument where is missing.
    `)
  })
})

describe('InvalidArgumentType', () => {
  test('simple', () => {
    expect(
      renderError(
        {
          kind: 'InvalidArgumentType',
          selectionPath: [],
          argumentPath: ['where', 'id'],
          argument: { name: 'id', typeNames: ['String'] },
          inferredType: 'Int',
        },
        { where: { id: 123 } },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
          id: 123
              ~~~
        }
      }

      Argument id: Invalid value provided. Expected String, provided Int.
    `)
  })

  test('nested argument', () => {
    expect(
      renderError(
        {
          kind: 'InvalidArgumentType',
          selectionPath: [],
          argumentPath: ['where', 'id', 'contains'],
          argument: { name: 'contains', typeNames: ['String'] },
          inferredType: 'Int',
        },
        { where: { id: { contains: 123 } } },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
          id: {
            contains: 123
                      ~~~
          }
        }
      }

      Argument contains: Invalid value provided. Expected String, provided Int.
    `)
  })

  test('multiple expected types', () => {
    expect(
      renderError(
        {
          kind: 'InvalidArgumentType',
          selectionPath: [],
          argumentPath: ['where', 'id'],
          argument: { name: 'id', typeNames: ['String', 'StringFilter'] },
          inferredType: 'Int',
        },
        { where: { id: 123 } },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
          id: 123
              ~~~
        }
      }

      Argument id: Invalid value provided. Expected String or StringFilter, provided Int.
    `)
  })

  test('nested selection', () => {
    expect(
      renderError(
        {
          kind: 'InvalidArgumentType',
          selectionPath: ['posts'],
          argumentPath: ['where', 'published'],
          argument: { name: 'published', typeNames: ['Boolean'] },
          inferredType: 'String',
        },
        { include: { posts: { where: { published: 'yes' } } } },
      ),
    ).toMatchInlineSnapshot(`
      {
        include: {
          posts: {
            where: {
              published: "yes"
                         ~~~~~
            }
          }
        }
      }

      Argument published: Invalid value provided. Expected Boolean, provided String.
    `)
  })

  test('nested selection and argument', () => {
    expect(
      renderError(
        {
          kind: 'InvalidArgumentType',
          selectionPath: ['posts'],
          argumentPath: ['where', 'publishedDate', 'gt'],
          argument: { name: 'gt', typeNames: ['Date'] },
          inferredType: 'String',
        },
        { include: { posts: { where: { publishedDate: { gt: 'now' } } } } },
      ),
    ).toMatchInlineSnapshot(`
      {
        include: {
          posts: {
            where: {
              publishedDate: {
                gt: "now"
                    ~~~~~
              }
            }
          }
        }
      }

      Argument gt: Invalid value provided. Expected Date, provided String.
    `)
  })
})

describe('InvalidArgumentValue', () => {
  test('simple', () => {
    expect(
      renderError(
        {
          kind: 'InvalidArgumentValue',
          selectionPath: [],
          argumentPath: ['where', 'createdAt'],
          argument: { name: 'createdAt', typeNames: ['IS0861 DateTime'] },
          underlyingError: 'Invalid characters',
        },
        { where: { createdAt: 'now' } },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
          createdAt: "now"
                     ~~~~~
        }
      }

      Invalid value for argument createdAt: Invalid characters. Expected IS0861 DateTime.
    `)
  })

  test('nested argument', () => {
    expect(
      renderError(
        {
          kind: 'InvalidArgumentValue',
          selectionPath: [],
          argumentPath: ['where', 'createdAt', 'gt'],
          argument: { name: 'createdAt', typeNames: ['IS0861 DateTime'] },
          underlyingError: 'Invalid characters',
        },
        { where: { createdAt: { gt: 'now' } } },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
          createdAt: {
            gt: "now"
                ~~~~~
          }
        }
      }

      Invalid value for argument createdAt: Invalid characters. Expected IS0861 DateTime.
    `)
  })

  test('nested selection', () => {
    expect(
      renderError(
        {
          kind: 'InvalidArgumentValue',
          selectionPath: ['posts'],
          argumentPath: ['where', 'createdAt'],
          argument: { name: 'createdAt', typeNames: ['ISO8601 DateTime'] },
          underlyingError: 'Invalid characters',
        },
        { include: { posts: { where: { createdAt: 'yes' } } } },
      ),
    ).toMatchInlineSnapshot(`
      {
        include: {
          posts: {
            where: {
              createdAt: "yes"
                         ~~~~~
            }
          }
        }
      }

      Invalid value for argument createdAt: Invalid characters. Expected ISO8601 DateTime.
    `)
  })

  test('nested selection and argument', () => {
    expect(
      renderError(
        {
          kind: 'InvalidArgumentValue',
          selectionPath: ['posts'],
          argumentPath: ['where', 'createdAt', 'equals'],
          argument: { name: 'equals', typeNames: ['ISO8601 DateTime'] },
          underlyingError: 'Invalid characters',
        },
        { include: { posts: { where: { createdAt: { equals: 'yes' } } } } },
      ),
    ).toMatchInlineSnapshot(`
      {
        include: {
          posts: {
            where: {
              createdAt: {
                equals: "yes"
                        ~~~~~
              }
            }
          }
        }
      }

      Invalid value for argument equals: Invalid characters. Expected ISO8601 DateTime.
    `)
  })
})

describe('Union', () => {
  test('longest path', () => {
    expect(
      renderError(
        {
          kind: 'Union',
          errors: [
            {
              kind: 'InvalidArgumentType',
              selectionPath: [],
              argumentPath: ['where', 'email', 'gt'],
              argument: { name: 'gt', typeNames: ['String'] },
              inferredType: 'Int',
            },

            {
              kind: 'InvalidArgumentType',
              selectionPath: [],
              argumentPath: ['where', 'email'],
              argument: { name: 'email', typeNames: ['String'] },
              inferredType: 'Object',
            },
          ],
        },
        {
          where: { email: { gt: 123 } },
        },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
          email: {
            gt: 123
                ~~~
          }
        }
      }

      Argument gt: Invalid value provided. Expected String, provided Int.
    `)
  })

  test('merge', () => {
    expect(
      renderError(
        {
          kind: 'Union',
          errors: [
            {
              kind: 'InvalidArgumentType',
              selectionPath: [],
              argumentPath: ['where', 'email'],
              argument: { name: 'gt', typeNames: ['String'] },
              inferredType: 'Int',
            },

            {
              kind: 'InvalidArgumentType',
              selectionPath: [],
              argumentPath: ['where', 'email'],
              argument: { name: 'email', typeNames: ['StringFilter'] },
              inferredType: 'Int',
            },
          ],
        },
        {
          where: { email: 123 },
        },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
          email: 123
                 ~~~
        }
      }

      Argument gt: Invalid value provided. Expected String or StringFilter, provided Int.
    `)
  })
})

describe('SomeFieldsMissing', () => {
  test('simple', () => {
    expect(
      renderError(
        {
          kind: 'SomeFieldsMissing',
          selectionPath: [],
          argumentPath: ['where'],
          inputType: {
            kind: 'object',
            name: 'UserWhereUniqueInput',
            fields: [
              { name: 'id', typeNames: ['String'], required: false },
              { name: 'email', typeNames: ['String'], required: false },
            ],
          },
          constraints: { minFieldCount: 1, requiredFields: null },
        },
        { where: {} },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
      ?   id?: String,
      ?   email?: String
        }
      }

      Argument where of type UserWhereUniqueInput needs at least one argument. Available options are listed in green.
    `)
  })

  test('multiple', () => {
    expect(
      renderError(
        {
          kind: 'SomeFieldsMissing',
          selectionPath: [],
          argumentPath: ['where'],
          inputType: {
            kind: 'object',
            name: 'UserWhereUniqueInput',
            fields: [
              { name: 'id', typeNames: ['String'], required: false },
              { name: 'email', typeNames: ['String'], required: false },
            ],
          },
          constraints: { minFieldCount: 2, requiredFields: null },
        },
        { where: {} },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
      ?   id?: String,
      ?   email?: String
        }
      }

      Argument where of type UserWhereUniqueInput needs at least 2 arguments. Available options are listed in green.
    `)
  })

  test('nested selection', () => {
    expect(
      renderError(
        {
          kind: 'SomeFieldsMissing',
          selectionPath: ['user'],
          argumentPath: ['where'],
          inputType: {
            kind: 'object',
            name: 'UserWhereUniqueInput',
            fields: [
              { name: 'id', typeNames: ['String'], required: false },
              { name: 'email', typeNames: ['String'], required: false },
            ],
          },
          constraints: { minFieldCount: 1, requiredFields: null },
        },
        { include: { user: { where: {} } } },
      ),
    ).toMatchInlineSnapshot(`
      {
        include: {
          user: {
            where: {
      ?       id?: String,
      ?       email?: String
            }
          }
        }
      }

      Argument where of type UserWhereUniqueInput needs at least one argument. Available options are listed in green.
    `)
  })

  test('with required fields', () => {
    expect(
      renderError(
        {
          kind: 'SomeFieldsMissing',
          selectionPath: [],
          argumentPath: ['where'],
          inputType: {
            kind: 'object',
            name: 'UserWhereUniqueInput',
            fields: [
              { name: 'id', typeNames: ['String'], required: false },
              { name: 'email', typeNames: ['String'], required: false },
            ],
          },
          constraints: { minFieldCount: 1, requiredFields: ['id', 'email'] },
        },
        { where: {} },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
      ?   id?: String,
      ?   email?: String
        }
      }

      Argument where of type UserWhereUniqueInput needs at least one of id or email arguments. Available options are listed in green.
    `)
  })
})

describe('TooManyFieldsGiven', () => {
  test('exactly one', () => {
    expect(
      renderError(
        {
          kind: 'TooManyFieldsGiven',
          selectionPath: [],
          argumentPath: ['where'],
          inputType: {
            kind: 'object',
            name: 'UserWhereUniqueInput',
            fields: [
              { name: 'id', typeNames: ['String'], required: false },
              { name: 'email', typeNames: ['String'], required: false },
            ],
          },
          constraints: { minFieldCount: 1, maxFieldCount: 1, requiredFields: null },
        },
        {
          where: {
            id: 'foo',
            email: 'foo@example.com',
          },
        },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
          id: "foo",
          email: "foo@example.com"
        }
        ~~~~~~~~~~~~~~~~~~~~~~~~~~
      }

      Argument where of type UserWhereUniqueInput needs exactly one argument, but you provided id and email. Please choose one.
    `)
  })

  test('at most one', () => {
    expect(
      renderError(
        {
          kind: 'TooManyFieldsGiven',
          selectionPath: [],
          argumentPath: ['where'],
          inputType: {
            kind: 'object',
            name: 'UserWhereUniqueInput',
            fields: [
              { name: 'id', typeNames: ['String'], required: false },
              { name: 'email', typeNames: ['String'], required: false },
            ],
          },
          constraints: { maxFieldCount: 1, requiredFields: null },
        },
        {
          where: {
            id: 'foo',
            email: 'foo@example.com',
          },
        },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
          id: "foo",
          email: "foo@example.com"
        }
        ~~~~~~~~~~~~~~~~~~~~~~~~~~
      }

      Argument where of type UserWhereUniqueInput needs at most one argument, but you provided id and email. Please choose one.
    `)
  })

  test('more than one', () => {
    expect(
      renderError(
        {
          kind: 'TooManyFieldsGiven',
          selectionPath: [],
          argumentPath: ['where'],
          inputType: {
            kind: 'object',
            name: 'UserWhereUniqueInput',
            fields: [
              { name: 'id', typeNames: ['String'], required: false },
              { name: 'email', typeNames: ['String'], required: false },
            ],
          },
          constraints: { maxFieldCount: 2, requiredFields: null },
        },
        {
          where: {
            id: 'foo',
            email: 'foo@example.com',
            nickname: 'bar',
          },
        },
      ),
    ).toMatchInlineSnapshot(`
      {
        where: {
          id: "foo",
          email: "foo@example.com",
          nickname: "bar"
        }
        ~~~~~~~~~~~~~~~~~~~~~~~~~~
      }

      Argument where of type UserWhereUniqueInput needs at most 2 arguments, but you provided id, email and nickname. Please choose 2.
    `)
  })

  test('nested selection', () => {
    expect(
      renderError(
        {
          kind: 'TooManyFieldsGiven',
          selectionPath: ['user'],
          argumentPath: ['where'],
          inputType: {
            kind: 'object',
            name: 'UserWhereUniqueInput',
            fields: [
              { name: 'id', typeNames: ['String'], required: false },
              { name: 'email', typeNames: ['String'], required: false },
            ],
          },
          constraints: { minFieldCount: 1, maxFieldCount: 1, requiredFields: null },
        },
        {
          select: {
            user: {
              where: {
                id: 'foo',
                email: 'foo@example.com',
              },
            },
          },
        },
      ),
    ).toMatchInlineSnapshot(`
      {
        select: {
          user: {
            where: {
              id: "foo",
              email: "foo@example.com"
            }
            ~~~~~~~~~~~~~~~~~~~~~~~~~~
          }
        }
      }

      Argument where of type UserWhereUniqueInput needs exactly one argument, but you provided id and email. Please choose one.
    `)
  })
})
