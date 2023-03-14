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

  test('nested argument', () => {
    expect(
      renderError(
        {
          kind: 'UnknownArgument',
          selectionPath: [],
          argumentPath: ['where', 'upvote'],
          arguments: [
            { name: 'id', typeNames: ['String'] },
            { name: 'name', typeNames: ['String'] },
            { name: 'upvotes', typeNames: ['Int', 'IntFilter'] },
          ],
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
})

describe('MissingRequiredArgument', () => {
  test('simple', () => {
    expect(
      renderError(
        {
          kind: 'MissingRequiredArgument',
          argumentName: 'where',
          argumentType: {
            name: 'UserWhereInput',
            fields: [
              { name: 'id', typeNames: ['Int'], required: false },
              { name: 'email', typeNames: ['String'], required: false },
            ],
          },
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

  test('with multiple types', () => {
    expect(
      renderError(
        {
          kind: 'MissingRequiredArgument',
          argumentName: 'where',
          argumentType: {
            name: 'UserWhereInput',
            fields: [{ name: 'id', typeNames: ['Int', 'String'], required: false }],
          },
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
})
