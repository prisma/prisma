import stripAnsi from 'strip-ansi'
import { blog } from '../fixtures/blog'
import { getDMMF } from '../generation/getDMMF'
import { DMMFClass } from '../runtime/dmmf'
import { makeDocument } from '../runtime/query'

let dmmf
beforeAll(async () => {
  const dmmfDocument = await getDMMF({ datamodel: blog })
  dmmf = new DMMFClass(dmmfDocument)
})

describe('select validation', () => {
  test('unknown arg, field, incorrect arg type', () => {
    const ast = {
      skip: 200,
      where: {
        name_contains: undefined,
        name_in: ['hans', 'peter', 'schmidt'],
        AND: [
          {
            age_gt: 10123123123,
            this_is_completely_arbitrary:
              'veryLongNameGoIntoaNewLineNow@gmail.com',
          },
          {
            age_gt: 10123123123,
            id_endsWith: 'veryLongNameGoIntoaNewLineNow@gmail.com',
            name_contains: 'hans',
            name_gt: 2131203912039123,
            name_in: ['hans'],
            AND: [
              {
                age_gt: '10123123123',
                id_endsWith: 'veryLongNameGoIntoaNewLineNow@gmail.com',
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: 'asd',
        name2: true,
        posts: {
          take: 200,
          select: {
            id: true,
            title: false,
          },
        },
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyUser',
    })
    expect(String(document)).toMatchSnapshot()

    try {
      document.validate(ast, undefined, undefined, 'minimal')
    } catch (e) {
      expect(e.message).toMatchSnapshot()
    }

    try {
      document.validate(ast, undefined, undefined, 'colorless')
    } catch (e) {
      expect(e.message).toMatchSnapshot()
    }

    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }
  })

  test('missing arg object', () => {
    const ast = {}

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }
  })

  test('missing arg object', () => {
    const ast = {}

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }

    try {
      document.validate(ast, undefined, undefined, 'minimal')
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }

    try {
      document.validate(ast, undefined, undefined, 'colorless')
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }
  })

  test('missing arg scalar', () => {
    const ast = {
      data: {
        title: 'string',
        author: {
          connect: { id: '' },
        },
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }
  })

  test('missing arg scalar && object', () => {
    const ast = {
      data: {
        title: 'string',
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }
  })

  test('Allow simple create mutation', () => {
    const ast = {
      data: {
        title: 'Some title',
        content: 'Some Content',
        published: false,
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('Allow explicit null value', () => {
    const ast = {
      data: {
        title: 'Some title',
        content: null,
        published: false,
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('Allow different iso strings 1', () => {
    const ast = {
      data: {
        title: 'Some title',
        content: null,
        published: false,
        createdAt: '2020-05-05T16:28:33.983Z',
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('Allow different iso strings 2', () => {
    const ast = {
      data: {
        title: 'Some title',
        content: null,
        published: false,
        createdAt: '2020-05-05T16:28:33.983+03:00',
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('Allow different iso strings 2', () => {
    const ast = {
      data: {
        title: 'Some title',
        content: null,
        published: false,
        createdAt: '2020-05-05T16:28:33.983-02:00',
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('Allow uuid for string input', () => {
    const ast = {
      data: {
        title: 'Some title',
        content: '123e4567-e89b-12d3-a456-426655440000',
        published: false,
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'mutation',
      rootField: 'createOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('Allow deep select query', () => {
    const ast = {
      select: {
        author: {
          select: {
            id: true,
          },
        },
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyPost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('Accept empty where in findMany', () => {
    const ast = {
      select: {
        author: {
          select: {
            id: true,
          },
        },
      },
      where: {},
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyPost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('allow where with all undefined in findMany', () => {
    const ast = {
      select: {
        author: {
          select: {
            id: true,
          },
        },
      },
      where: {
        id: undefined,
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyPost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('reject empty where for findUnique', () => {
    const ast = {
      select: {
        author: {
          select: {
            id: true,
          },
        },
      },
      where: {},
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }
  })

  test('reject all undefined where for findUnique', () => {
    const ast = {
      select: {
        author: {
          select: {
            id: true,
          },
        },
      },
      where: {
        id: undefined,
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findOnePost',
    })

    expect(String(document)).toMatchSnapshot()
    try {
      document.validate(ast)
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }
  })

  test('Allow uuid array for string array', () => {
    const ast = {
      select: {
        author: {
          select: {
            id: true,
          },
        },
      },
      where: {
        id: {
          in: ['d4082b42-b161-11e9-8754-6542abf52968'],
        },
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyPost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('Allow empty input array', () => {
    const ast = {
      select: {
        author: {
          select: {
            id: true,
          },
        },
      },
      where: {
        id: {
          in: [],
        },
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyPost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })

  test('Allow select with an include', () => {
    const ast = {
      select: {
        author: {
          include: { posts: true },
        },
      },
    }

    const document = makeDocument({
      dmmf,
      select: ast,
      rootTypeName: 'query',
      rootField: 'findManyPost',
    })

    expect(String(document)).toMatchSnapshot()
    expect(() => document.validate(ast)).not.toThrow()
  })
})
