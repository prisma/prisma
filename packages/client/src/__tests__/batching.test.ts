import { blog } from '../fixtures/blog'
import { getDMMF } from '../generation/getDMMF'
import { DMMFClass, makeDocument } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/MergedExtensionsList'
import { RequestHandler } from '../runtime/RequestHandler'

describe('batching', () => {
  test('basic batching', async () => {
    const dmmf = new DMMFClass(await getDMMF({ datamodel: blog }))
    const batches: any[] = []
    const requests: any[] = []

    const fetcher = new RequestHandler({
      $connect: () => Promise.resolve(),
      _engine: {
        // @ts-expect-error
        requestBatch: (batch) => {
          batches.push(batch)
          return Promise.resolve(batch.queries.map(() => ({ data: { data: null }, elapsed: 0.2 })))
        },
        // @ts-expect-error
        request: (request) => {
          requests.push(request)
          return Promise.resolve({ data: { data: null }, elapsed: 0.3 })
        },
      },
    })

    await Promise.all([
      fetcher.request({
        clientMethod: 'findUnique',
        dataPath: [],
        document: makeDocument({
          dmmf,
          select: {
            where: {
              id: '1',
            },
          },
          rootTypeName: 'query',
          rootField: 'findUniqueUser',
          extensions: MergedExtensionsList.empty(),
        }),
        isList: false,
        rootField: 'query',
        typeName: 'User',
        args: {
          where: {
            id: '1',
          },
        },
        extensions: MergedExtensionsList.empty(),
      }),
      fetcher.request({
        clientMethod: 'findUnique',
        dataPath: [],
        document: makeDocument({
          dmmf,
          select: {
            where: {
              id: '2',
            },
          },
          rootTypeName: 'query',
          rootField: 'findUniqueUser',
          extensions: MergedExtensionsList.empty(),
        }),
        isList: false,
        rootField: 'query',
        typeName: 'User',
        args: {
          where: {
            id: '2',
          },
        },
        extensions: MergedExtensionsList.empty(),
      }),
    ])

    expect(batches).toMatchInlineSnapshot(`
      [
        {
          containsWrite: false,
          headers: {
            traceparent: 00-10-10-00,
          },
          queries: [
            query {
        findUniqueUser(where: {
          id: "1"
        }) {
          id
          email
          name
          json
          countFloat
          countInt1
          countInt2
          countInt3
          countInt4
          countInt5
          countInt6
          lastLoginAt
          coinflips
        }
      },
            query {
        findUniqueUser(where: {
          id: "2"
        }) {
          id
          email
          name
          json
          countFloat
          countInt1
          countInt2
          countInt3
          countInt4
          countInt5
          countInt6
          lastLoginAt
          coinflips
        }
      },
          ],
          transaction: undefined,
        },
      ]
    `)
    expect(requests).toMatchInlineSnapshot(`[]`)
  })

  test('dont batch different models', async () => {
    const dmmf = new DMMFClass(await getDMMF({ datamodel: blog }))
    const batches: any[] = []
    const requests: any[] = []

    const fetcher = new RequestHandler({
      $connect: () => Promise.resolve(),
      _engine: {
        // @ts-expect-error
        requestBatch: (batch) => {
          batches.push(batch)
          return Promise.resolve(batch.queries.map(() => ({ data: { data: null }, elapsed: 0.2 })))
        },
        // @ts-expect-error
        request: (request) => {
          requests.push(request)
          return Promise.resolve({ data: { data: null }, elapsed: 0.3 })
        },
      },
    })

    await Promise.all([
      fetcher.request({
        clientMethod: 'findUnique',
        dataPath: [],
        document: makeDocument({
          dmmf,
          select: {
            where: {
              id: '1',
            },
          },
          rootTypeName: 'query',
          rootField: 'findUniquePost',
          extensions: MergedExtensionsList.empty(),
        }),
        isList: false,
        rootField: 'query',
        typeName: 'User',
        args: {
          where: { id: '1' },
        },
        extensions: MergedExtensionsList.empty(),
      }),
      fetcher.request({
        clientMethod: 'findUnique',
        dataPath: [],
        document: makeDocument({
          dmmf,
          select: {
            where: {
              id: '2',
            },
          },
          rootTypeName: 'query',
          rootField: 'findUniqueUser',
          extensions: MergedExtensionsList.empty(),
        }),
        isList: false,
        rootField: 'query',
        typeName: 'User',
        args: {
          where: { id: '2' },
        },
        extensions: MergedExtensionsList.empty(),
      }),
    ])

    expect(batches).toMatchInlineSnapshot(`[]`)
    expect(requests).toMatchInlineSnapshot(`
      [
        {
          headers: {
            traceparent: 00-10-10-00,
          },
          isWrite: false,
          query: query {
        findUniquePost(where: {
          id: "1"
        }) {
          id
          createdAt
          updatedAt
          published
          title
          content
          authorId
          optional
        }
      },
          transaction: undefined,
        },
        {
          headers: {
            traceparent: 00-10-10-00,
          },
          isWrite: false,
          query: query {
        findUniqueUser(where: {
          id: "2"
        }) {
          id
          email
          name
          json
          countFloat
          countInt1
          countInt2
          countInt3
          countInt4
          countInt5
          countInt6
          lastLoginAt
          coinflips
        }
      },
          transaction: undefined,
        },
      ]
    `)
  })

  test('dont batch different wheres', async () => {
    const dmmf = new DMMFClass(await getDMMF({ datamodel: blog }))
    const batches: any[] = []
    const requests: any[] = []

    const fetcher = new RequestHandler({
      $connect: () => Promise.resolve(),
      _engine: {
        // @ts-expect-error
        requestBatch: (batch) => {
          batches.push(batch)
          return Promise.resolve(batch.queries.map(() => ({ data: { data: null }, elapsed: 0.2 })))
        },
        // @ts-expect-error
        request: (request) => {
          requests.push(request)
          return Promise.resolve({ data: { data: null }, elapsed: 0.3 })
        },
      },
    })

    await Promise.all([
      fetcher.request({
        clientMethod: 'findUnique',
        dataPath: [],
        document: makeDocument({
          dmmf,
          select: {
            where: {
              email: 'a@a.de',
            },
          },
          rootTypeName: 'query',
          rootField: 'findUniqueUser',
          extensions: MergedExtensionsList.empty(),
        }),
        isList: false,
        rootField: 'query',
        typeName: 'User',
        args: { where: { email: 'a@a.de' } },
        extensions: MergedExtensionsList.empty(),
      }),
      fetcher.request({
        clientMethod: 'findUnique',
        dataPath: [],
        document: makeDocument({
          dmmf,
          select: {
            where: {
              id: '2',
            },
          },
          rootTypeName: 'query',
          rootField: 'findUniqueUser',
          extensions: MergedExtensionsList.empty(),
        }),
        isList: false,
        rootField: 'query',
        typeName: 'User',
        args: { where: { id: '2' } },
        extensions: MergedExtensionsList.empty(),
      }),
    ])

    expect(batches).toMatchInlineSnapshot(`[]`)
    expect(requests).toMatchInlineSnapshot(`
      [
        {
          headers: {
            traceparent: 00-10-10-00,
          },
          isWrite: false,
          query: query {
        findUniqueUser(where: {
          email: "a@a.de"
        }) {
          id
          email
          name
          json
          countFloat
          countInt1
          countInt2
          countInt3
          countInt4
          countInt5
          countInt6
          lastLoginAt
          coinflips
        }
      },
          transaction: undefined,
        },
        {
          headers: {
            traceparent: 00-10-10-00,
          },
          isWrite: false,
          query: query {
        findUniqueUser(where: {
          id: "2"
        }) {
          id
          email
          name
          json
          countFloat
          countInt1
          countInt2
          countInt3
          countInt4
          countInt5
          countInt6
          lastLoginAt
          coinflips
        }
      },
          transaction: undefined,
        },
      ]
    `)
  })
})
