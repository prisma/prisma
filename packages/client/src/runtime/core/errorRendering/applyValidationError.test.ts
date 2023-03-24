import chalk from 'chalk'
import ansiEscapesSerializer from 'jest-serializer-ansi-escapes'

import { Writer } from '../../../generation/ts-builders/Writer'
import { JsArgs } from '../types/JsApi'
import { ValidationError } from '../types/ValidationError'
import { applyValidationError } from './applyValidationError'
import { buildArgumentsRenderingTree } from './ArgumentsRenderingTree'

expect.addSnapshotSerializer(ansiEscapesSerializer)

const renderError = (error: ValidationError, args: JsArgs) => {
  const argsTree = buildArgumentsRenderingTree(args)
  applyValidationError(error, argsTree)

  const disabledChalk = new chalk.Instance()
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
        <brightRed>include</color>: {},
        <brightRed>~~~~~~~</color>
        <brightRed>select</color>: {}
        <brightRed>~~~~~~</color>
      }

      Please <bold>either</intensity> use <brightGreen>\`include\`</color> or <brightGreen>\`select\`</color>, but <brightRed>not both</color> at the same time.
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
                <brightRed>select</color>: {},
                <brightRed>~~~~~~</color>
                <brightRed>include</color>: {}
                <brightRed>~~~~~~~</color>
              }
            }
          }
        }
      }

      Please <bold>either</intensity> use <brightGreen>\`include\`</color> or <brightGreen>\`select\`</color>, but <brightRed>not both</color> at the same time.
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
          <brightRed>id</color>: true
          <brightRed>~~</color>
        }
      }

      Invalid scalar field <brightRed>\`id\`</color> for <bold>include</intensity> statement.
      Note that <bold>include</intensity> statements only accept relation fields.
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
          <brightRed>id</color>: true,
          <brightRed>~~</color>
      <brightGreen>?</color>   <brightGreen>posts</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>
        }
      }

      Invalid scalar field <brightRed>\`id\`</color> for <bold>include</intensity> statement on model <bold>User</intensity>. Available options are listed in <brightGreen>green</color>.
      Note that <bold>include</intensity> statements only accept relation fields.
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
              <brightRed>id</color>: true
              <brightRed>~~</color>
            }
          }
        }
      }

      Invalid scalar field <brightRed>\`id\`</color> for <bold>include</intensity> statement.
      Note that <bold>include</intensity> statements only accept relation fields.
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
              <brightRed>id</color>: true,
              <brightRed>~~</color>
      <brightGreen>?</color>       <brightGreen>likes</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>
            }
          }
        }
      }

      Invalid scalar field <brightRed>\`id\`</color> for <bold>include</intensity> statement on model <bold>Post</intensity>. Available options are listed in <brightGreen>green</color>.
      Note that <bold>include</intensity> statements only accept relation fields.
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
      <brightGreen>?</color>   <brightGreen>id</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>,
      <brightGreen>?</color>   <brightGreen>title</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>,
      <brightGreen>?</color>   <brightGreen>comments</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>
        }
      }

      The <red>\`select\`</color> statement for type <bold>Post</intensity> must not be empty. Available options are listed in <brightGreen>green</color>.
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
      <brightGreen>?</color>   <brightGreen>id</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>,
      <brightGreen>?</color>   <brightGreen>title</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>,
      <brightGreen>?</color>   <brightGreen>comments</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>
        }
      }

      The <red>\`select\`</color> statement for type <bold>Post</intensity> needs <bold>at least one truthy value</intensity>.
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
      <brightGreen>?</color>           <brightGreen>id</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>,
      <brightGreen>?</color>           <brightGreen>title</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>,
      <brightGreen>?</color>           <brightGreen>comments</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>
                }
              }
            }
          }
        }
      }

      The <red>\`select\`</color> statement for type <bold>Post</intensity> must not be empty. Available options are listed in <brightGreen>green</color>.
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
          <brightRed>notThere</color>: true,
          <brightRed>~~~~~~~~</color>
      <brightGreen>?</color>   <brightGreen>id</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>,
      <brightGreen>?</color>   <brightGreen>title</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>,
      <brightGreen>?</color>   <brightGreen>comments</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>
        }
      }

      Unknown field <brightRed>\`notThere\`</color> for <bold>select</intensity> statement on model <bold>Post</intensity>. Available options are listed in <brightGreen>green</color>.
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
          <brightRed>notThere</color>: true,
          <brightRed>~~~~~~~~</color>
      <brightGreen>?</color>   <brightGreen>id</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>,
      <brightGreen>?</color>   <brightGreen>title</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>,
      <brightGreen>?</color>   <brightGreen>comments</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>
        }
      }

      Unknown field <brightRed>\`notThere\`</color> for <bold>include</intensity> statement on model <bold>Post</intensity>. Available options are listed in <brightGreen>green</color>.
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
                  <brightRed>notThere</color>: true,
                  <brightRed>~~~~~~~~</color>
      <brightGreen>?</color>           <brightGreen>id</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>,
      <brightGreen>?</color>           <brightGreen>title</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>,
      <brightGreen>?</color>           <brightGreen>comments</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>
                }
              }
            }
          }
        }
      }

      Unknown field <brightRed>\`notThere\`</color> for <bold>select</intensity> statement on model <bold>Post</intensity>. Available options are listed in <brightGreen>green</color>.
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
                  <brightRed>notThere</color>: true,
                  <brightRed>~~~~~~~~</color>
      <brightGreen>?</color>           <brightGreen>id</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>,
      <brightGreen>?</color>           <brightGreen>title</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>,
      <brightGreen>?</color>           <brightGreen>comments</color><brightGreen>?</color><brightGreen>: </color><brightGreen>true</color>
                }
              }
            }
          }
        }
      }

      Unknown field <brightRed>\`notThere\`</color> for <bold>include</intensity> statement on model <bold>Post</intensity>. Available options are listed in <brightGreen>green</color>.
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
        <brightRed>wher</color>: {
        <brightRed>~~~~</color>
          id: 123
        },
      <brightGreen>?</color> <brightGreen>where</color><brightGreen>?</color><brightGreen>: </color><brightGreen>PostWhereInput</color>,
      <brightGreen>?</color> <brightGreen>orderBy</color><brightGreen>?</color><brightGreen>: </color><brightGreen>PostOrderByWithRelationInput | List<PostOrderByWithRelationInput></color>,
      <brightGreen>?</color> <brightGreen>take</color><brightGreen>?</color><brightGreen>: </color><brightGreen>Int</color>
      }

      Unknown argument <brightRed>wher</color>. Did you mean \`<brightGreen>where</color>\`? Available options are listed in <brightGreen>green</color>.
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
        <brightRed>wher</color>: {
        <brightRed>~~~~</color>
          id: 123
        }
      }

      Unknown argument <brightRed>wher</color>.
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
        <brightRed>completelyNotThere</color>: {
        <brightRed>~~~~~~~~~~~~~~~~~~</color>
          id: 123
        },
      <brightGreen>?</color> <brightGreen>where</color><brightGreen>?</color><brightGreen>: </color><brightGreen>PostWhereInput</color>,
      <brightGreen>?</color> <brightGreen>orderBy</color><brightGreen>?</color><brightGreen>: </color><brightGreen>PostOrderByWithRelationInput | List<PostOrderByWithRelationInput></color>,
      <brightGreen>?</color> <brightGreen>take</color><brightGreen>?</color><brightGreen>: </color><brightGreen>Int</color>
      }

      Unknown argument <brightRed>completelyNotThere</color>. Available options are listed in <brightGreen>green</color>.
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
                <brightRed>wherr</color>: {
                <brightRed>~~~~~</color>
                  upvotes: 0
                },
      <brightGreen>?</color>         <brightGreen>where</color><brightGreen>?</color><brightGreen>: </color><brightGreen>CommentWhereInput</color>,
      <brightGreen>?</color>         <brightGreen>orderBy</color><brightGreen>?</color><brightGreen>: </color><brightGreen>CommentOrderByWithRelationInput | List<CommentOrderByWithRelationInput></color>,
      <brightGreen>?</color>         <brightGreen>take</color><brightGreen>?</color><brightGreen>: </color><brightGreen>Int</color>
              }
            }
          }
        }
      }

      Unknown argument <brightRed>wherr</color>. Did you mean \`<brightGreen>where</color>\`? Available options are listed in <brightGreen>green</color>.
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
          <brightRed>upvote</color>: {
          <brightRed>~~~~~~</color>
            gt: 0
          },
      <brightGreen>?</color>   <brightGreen>id</color><brightGreen>?</color><brightGreen>: </color><brightGreen>String</color>,
      <brightGreen>?</color>   <brightGreen>name</color><brightGreen>?</color><brightGreen>: </color><brightGreen>String</color>,
      <brightGreen>?</color>   <brightGreen>upvotes</color><brightGreen>?</color><brightGreen>: </color><brightGreen>Int | IntFilter</color>
        }
      }

      Unknown argument <brightRed>upvote</color>. Did you mean \`<brightGreen>upvotes</color>\`? Available options are listed in <brightGreen>green</color>.
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
          <brightRed>somethingCompletelyDifferent</color>: {
          <brightRed>~~~~~~~~~~~~~~~~~~~~~~~~~~~~</color>
            gt: 0
          },
      <brightGreen>?</color>   <brightGreen>id</color><brightGreen>?</color><brightGreen>: </color><brightGreen>String</color>,
      <brightGreen>?</color>   <brightGreen>name</color><brightGreen>?</color><brightGreen>: </color><brightGreen>String</color>,
      <brightGreen>?</color>   <brightGreen>upvotes</color><brightGreen>?</color><brightGreen>: </color><brightGreen>Int | IntFilter</color>
        }
      }

      Unknown argument <brightRed>somethingCompletelyDifferent</color>. Available options are listed in <brightGreen>green</color>.
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
              <brightRed>upvote</color>: {
              <brightRed>~~~~~~</color>
                gt: 0
              },
      <brightGreen>?</color>       <brightGreen>id</color><brightGreen>?</color><brightGreen>: </color><brightGreen>String</color>,
      <brightGreen>?</color>       <brightGreen>name</color><brightGreen>?</color><brightGreen>: </color><brightGreen>String</color>,
      <brightGreen>?</color>       <brightGreen>upvotes</color><brightGreen>?</color><brightGreen>: </color><brightGreen>Int | IntFilter</color>
            }
          }
        }
      }

      Unknown argument <brightRed>upvote</color>. Did you mean \`<brightGreen>upvotes</color>\`? Available options are listed in <brightGreen>green</color>.
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
      <brightGreen>+</color> <brightGreen>where</color><brightGreen>: </color><brightGreen>{</color>
      <brightGreen><dim>+</intensity></color>   <brightGreen><dim>id: Int</intensity></color>,
      <brightGreen><dim>+</intensity></color>   <brightGreen><dim>email: String</intensity></color>
      <brightGreen>+</color> <brightGreen>}</color>
      }

      Argument <brightGreen>where</color> is missing.
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
      <brightGreen>+</color> <brightGreen>where</color><brightGreen>: </color><brightGreen>{</color>
      <brightGreen><dim>+</intensity></color>   <brightGreen><dim>id: Int | String</intensity></color>
      <brightGreen>+</color> <brightGreen>}</color>
      }

      Argument <brightGreen>where</color> is missing.
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
      <brightGreen>+</color> <brightGreen>where</color><brightGreen>: </color><brightGreen>UserWhereInput | UserBetterWhereInput</color>
      }

      Argument <brightGreen>where</color> is missing.
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
      <brightGreen>+</color> <brightGreen>data</color><brightGreen>: </color><brightGreen>UserCreateInput[]</color>
      }

      Argument <brightGreen>data</color> is missing.
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
      <brightGreen>+</color>   <brightGreen>email</color><brightGreen>: </color><brightGreen>String</color>
        }
      }

      Argument <brightGreen>email</color> is missing.
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
      <brightGreen>+</color>     <brightGreen>where</color><brightGreen>: </color><brightGreen>{</color>
      <brightGreen><dim>+</intensity></color>       <brightGreen><dim>id: Int</intensity></color>,
      <brightGreen><dim>+</intensity></color>       <brightGreen><dim>email: String</intensity></color>
      <brightGreen>+</color>     <brightGreen>}</color>
          }
        }
      }

      Argument <brightGreen>where</color> is missing.
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
          id: <brightRed>123</color>
              <brightRed>~~~</color>
        }
      }

      Argument <bold>id</intensity>: Invalid value provided. Expected <brightGreen>String</color>, provided <brightRed>Int</color>.
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
            contains: <brightRed>123</color>
                      <brightRed>~~~</color>
          }
        }
      }

      Argument <bold>contains</intensity>: Invalid value provided. Expected <brightGreen>String</color>, provided <brightRed>Int</color>.
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
          id: <brightRed>123</color>
              <brightRed>~~~</color>
        }
      }

      Argument <bold>id</intensity>: Invalid value provided. Expected <brightGreen>String</color> or <brightGreen>StringFilter</color>, provided <brightRed>Int</color>.
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
              published: <brightRed>"yes"</color>
                         <brightRed>~~~~~</color>
            }
          }
        }
      }

      Argument <bold>published</intensity>: Invalid value provided. Expected <brightGreen>Boolean</color>, provided <brightRed>String</color>.
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
                gt: <brightRed>"now"</color>
                    <brightRed>~~~~~</color>
              }
            }
          }
        }
      }

      Argument <bold>gt</intensity>: Invalid value provided. Expected <brightGreen>Date</color>, provided <brightRed>String</color>.
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
          createdAt: <brightRed>"now"</color>
                     <brightRed>~~~~~</color>
        }
      }

      Invalid value for argument <bold>createdAt</intensity>: Invalid characters. Expected <brightGreen>IS0861 DateTime</color>.
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
            gt: <brightRed>"now"</color>
                <brightRed>~~~~~</color>
          }
        }
      }

      Invalid value for argument <bold>createdAt</intensity>: Invalid characters. Expected <brightGreen>IS0861 DateTime</color>.
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
              createdAt: <brightRed>"yes"</color>
                         <brightRed>~~~~~</color>
            }
          }
        }
      }

      Invalid value for argument <bold>createdAt</intensity>: Invalid characters. Expected <brightGreen>ISO8601 DateTime</color>.
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
                equals: <brightRed>"yes"</color>
                        <brightRed>~~~~~</color>
              }
            }
          }
        }
      }

      Invalid value for argument <bold>equals</intensity>: Invalid characters. Expected <brightGreen>ISO8601 DateTime</color>.
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
            gt: <brightRed>123</color>
                <brightRed>~~~</color>
          }
        }
      }

      Argument <bold>gt</intensity>: Invalid value provided. Expected <brightGreen>String</color>, provided <brightRed>Int</color>.
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
          email: <brightRed>123</color>
                 <brightRed>~~~</color>
        }
      }

      Argument <bold>gt</intensity>: Invalid value provided. Expected <brightGreen>String</color> or <brightGreen>StringFilter</color>, provided <brightRed>Int</color>.
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
      <brightGreen>?</color>   <brightGreen>id</color><brightGreen>?</color><brightGreen>: </color><brightGreen>String</color>,
      <brightGreen>?</color>   <brightGreen>email</color><brightGreen>?</color><brightGreen>: </color><brightGreen>String</color>
        }
      }

      Argument <bold>where</intensity> of type <bold>UserWhereUniqueInput</intensity> needs <brightGreen>at least one</color> argument. Available options are listed in <brightGreen>green</color>.
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
      <brightGreen>?</color>   <brightGreen>id</color><brightGreen>?</color><brightGreen>: </color><brightGreen>String</color>,
      <brightGreen>?</color>   <brightGreen>email</color><brightGreen>?</color><brightGreen>: </color><brightGreen>String</color>
        }
      }

      Argument <bold>where</intensity> of type <bold>UserWhereUniqueInput</intensity> needs <brightGreen>at least 2</color> arguments. Available options are listed in <brightGreen>green</color>.
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
      <brightGreen>?</color>       <brightGreen>id</color><brightGreen>?</color><brightGreen>: </color><brightGreen>String</color>,
      <brightGreen>?</color>       <brightGreen>email</color><brightGreen>?</color><brightGreen>: </color><brightGreen>String</color>
            }
          }
        }
      }

      Argument <bold>where</intensity> of type <bold>UserWhereUniqueInput</intensity> needs <brightGreen>at least one</color> argument. Available options are listed in <brightGreen>green</color>.
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
      <brightGreen>?</color>   <brightGreen>id</color><brightGreen>?</color><brightGreen>: </color><brightGreen>String</color>,
      <brightGreen>?</color>   <brightGreen>email</color><brightGreen>?</color><brightGreen>: </color><brightGreen>String</color>
        }
      }

      Argument <bold>where</intensity> of type <bold>UserWhereUniqueInput</intensity> needs <brightGreen>at least one of</color> <bold>id</intensity> or <bold>email</intensity> arguments. Available options are listed in <brightGreen>green</color>.
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
        <brightRed>~~~~~~~~~~~~~~~~~~~~~~~~~~</color>
      }

      Argument <bold>where</intensity> of type <bold>UserWhereUniqueInput</intensity> needs <brightGreen>exactly one</color> argument, but you provided <brightRed>id</color> and <brightRed>email</color>. Please choose one.
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
        <brightRed>~~~~~~~~~~~~~~~~~~~~~~~~~~</color>
      }

      Argument <bold>where</intensity> of type <bold>UserWhereUniqueInput</intensity> needs <brightGreen>at most one</color> argument, but you provided <brightRed>id</color> and <brightRed>email</color>. Please choose one.
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
        <brightRed>~~~~~~~~~~~~~~~~~~~~~~~~~~</color>
      }

      Argument <bold>where</intensity> of type <bold>UserWhereUniqueInput</intensity> needs <brightGreen>at most 2</color> arguments, but you provided <brightRed>id</color>, <brightRed>email</color> and <brightRed>nickname</color>. Please choose 2.
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
            <brightRed>~~~~~~~~~~~~~~~~~~~~~~~~~~</color>
          }
        }
      }

      Argument <bold>where</intensity> of type <bold>UserWhereUniqueInput</intensity> needs <brightGreen>exactly one</color> argument, but you provided <brightRed>id</color> and <brightRed>email</color>. Please choose one.
    `)
  })
})
