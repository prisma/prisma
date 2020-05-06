import { PrismaClientFetcher } from '../runtime/getPrismaClient'
import { blog } from '../fixtures/blog'
import { getDMMF } from '../generation/getDMMF'
import { DMMFClass, makeDocument } from '../runtime'

describe('batching', () => {
  test('basic batching', async () => {
    const dmmf = new DMMFClass(await getDMMF({ datamodel: blog }))
    const batches: any[] = []
    const requests: any[] = []

    const fetcher = new PrismaClientFetcher({
      connect: () => Promise.resolve(),
      engine: {
        requestBatch: (batch) => {
          batches.push(batch)
          return batch.map(() => ({ data: null }))
        },
        request: (request) => {
          requests.push(request)
          return { data: null }
        },
      },
    })

    await Promise.all([
      fetcher.request({
        clientMethod: 'findOne',
        dataPath: [],
        document: makeDocument({
          dmmf,
          select: {
            where: {
              id: '1',
            },
          },
          rootTypeName: 'query',
          rootField: 'findOneUser',
        }),
        isList: false,
        rootField: 'query',
        typeName: 'User',
      }),
      fetcher.request({
        clientMethod: 'findOne',
        dataPath: [],
        document: makeDocument({
          dmmf,
          select: {
            where: {
              id: '2',
            },
          },
          rootTypeName: 'query',
          rootField: 'findOneUser',
        }),
        isList: false,
        rootField: 'query',
        typeName: 'User',
      }),
    ])

    expect(batches).toMatchInlineSnapshot(`
      Array [
        Array [
          "query {
        findOneUser(where: {
          id: \\"1\\"
        }) {
          id
          email
          name
          json
        }
      }",
          "query {
        findOneUser(where: {
          id: \\"2\\"
        }) {
          id
          email
          name
          json
        }
      }",
        ],
      ]
    `)
    expect(requests).toMatchInlineSnapshot(`Array []`)
  })

  test('dont batch different models', async () => {
    const dmmf = new DMMFClass(await getDMMF({ datamodel: blog }))
    const batches: any[] = []
    const requests: any[] = []

    const fetcher = new PrismaClientFetcher({
      connect: () => Promise.resolve(),
      engine: {
        requestBatch: (batch) => {
          batches.push(batch)
          return batch.map(() => ({ data: null }))
        },
        request: (request) => {
          requests.push(request)
          return { data: null }
        },
      },
    })

    await Promise.all([
      fetcher.request({
        clientMethod: 'findOne',
        dataPath: [],
        document: makeDocument({
          dmmf,
          select: {
            where: {
              id: '1',
            },
          },
          rootTypeName: 'query',
          rootField: 'findOnePost',
        }),
        isList: false,
        rootField: 'query',
        typeName: 'User',
      }),
      fetcher.request({
        clientMethod: 'findOne',
        dataPath: [],
        document: makeDocument({
          dmmf,
          select: {
            where: {
              id: '2',
            },
          },
          rootTypeName: 'query',
          rootField: 'findOneUser',
        }),
        isList: false,
        rootField: 'query',
        typeName: 'User',
      }),
    ])

    expect(batches).toMatchInlineSnapshot(`Array []`)
    expect(requests).toMatchInlineSnapshot(`
      Array [
        "query {
        findOnePost(where: {
          id: \\"1\\"
        }) {
          id
          createdAt
          updatedAt
          published
          title
          content
          authorId
        }
      }",
        "query {
        findOneUser(where: {
          id: \\"2\\"
        }) {
          id
          email
          name
          json
        }
      }",
      ]
    `)
  })

  test('dont batch different wheres', async () => {
    const dmmf = new DMMFClass(await getDMMF({ datamodel: blog }))
    const batches: any[] = []
    const requests: any[] = []

    const fetcher = new PrismaClientFetcher({
      connect: () => Promise.resolve(),
      engine: {
        requestBatch: (batch) => {
          batches.push(batch)
          return batch.map(() => ({ data: null }))
        },
        request: (request) => {
          requests.push(request)
          return { data: null }
        },
      },
    })

    await Promise.all([
      fetcher.request({
        clientMethod: 'findOne',
        dataPath: [],
        document: makeDocument({
          dmmf,
          select: {
            where: {
              email: 'a@a.de',
            },
          },
          rootTypeName: 'query',
          rootField: 'findOneUser',
        }),
        isList: false,
        rootField: 'query',
        typeName: 'User',
      }),
      fetcher.request({
        clientMethod: 'findOne',
        dataPath: [],
        document: makeDocument({
          dmmf,
          select: {
            where: {
              id: '2',
            },
          },
          rootTypeName: 'query',
          rootField: 'findOneUser',
        }),
        isList: false,
        rootField: 'query',
        typeName: 'User',
      }),
    ])

    expect(batches).toMatchInlineSnapshot(`Array []`)
    expect(requests).toMatchInlineSnapshot(`
      Array [
        "query {
        findOneUser(where: {
          email: \\"a@a.de\\"
        }) {
          id
          email
          name
          json
        }
      }",
        "query {
        findOneUser(where: {
          id: \\"2\\"
        }) {
          id
          email
          name
          json
        }
      }",
      ]
    `)
  })
})
