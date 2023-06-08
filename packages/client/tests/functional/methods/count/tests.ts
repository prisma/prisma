import { getQueryEngineProtocol } from '@prisma/internals'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite((_suiteConfig, _suiteMeta, clientMeta) => {
  beforeAll(async () => {
    await prisma.user.create({ data: { email: 'user-1@email.com', age: 111, name: 'some-name-1' } })
    await prisma.user.create({ data: { email: 'user-2@email.com', age: 222, name: 'some-name-2' } })
    await prisma.user.create({ data: { email: 'user-3@email.com', age: 333, name: 'some-name-3' } })
  })

  test('simple', async () => {
    const value = await prisma.user.count()

    expect(value).toMatchInlineSnapshot(`3`)
  })

  test('where', async () => {
    const value = await prisma.user.count({
      where: {
        age: 111,
      },
    })

    expect(value).toMatchInlineSnapshot(`1`)
  })

  test('select where', async () => {
    const value = await prisma.user.count({
      select: true,
      where: {
        age: 111,
      },
    })

    expect(value).toMatchInlineSnapshot(`1`)
  })

  test('select mixed where', async () => {
    const value = await prisma.user.count({
      select: {
        _all: true,
        email: true,
        age: true,
        name: true,
      },
      where: {
        age: 111,
      },
    })

    expect(value).toMatchInlineSnapshot(`
      {
        _all: 1,
        age: 1,
        email: 1,
        name: 1,
      }
    `)
  })

  test('select all true', async () => {
    const value = await prisma.user.count({
      select: true, // count with a selection
    })

    expect(value).toMatchInlineSnapshot(`3`)
  })

  test('select all false', async () => {
    const value = await prisma.user.count({
      // @ts-expect-error - TODO There is a bug here
      select: false, // count with no selection
    })

    expect(value).toMatchInlineSnapshot(`3`)
  })

  test('select mixed', async () => {
    const value = await prisma.user.count({
      select: {
        _all: true,
        email: true,
        age: true,
        name: true,
      },
    })

    expect(value).toMatchInlineSnapshot(`
      {
        _all: 3,
        age: 3,
        email: 3,
        name: 3,
      }
    `)
  })

  testIf(clientMeta.runtime !== 'edge' && getQueryEngineProtocol() !== 'json')('bad prop', async () => {
    const err = prisma.user.count({
      select: {
        _all: true,
        email: true,
        age: true,
        name: true,
        // @ts-expect-error
        posts: true,
      },
    })

    await expect(err).rejects.toMatchPrismaErrorInlineSnapshot(`

      Invalid \`prisma.user.count()\` invocation in
      /client/tests/functional/methods/count/tests.ts:0:0

        XX })
        XX 
        XX testIf(clientMeta.runtime !== 'edge' && getQueryEngineProtocol() !== 'json')('bad prop', async () => {
      → XX   const err = prisma.user.count({
                select: {
                  _count: {
                    select: {
              ?       _all?: true,
              ?       email?: true,
              ?       age?: true,
              ?       name?: true,
                      posts: true,
                      ~~~~~
              ?       id?: true
                    }
                  }
                }
              })


      Unknown field \`posts\` for select statement on model UserCountAggregateOutputType. Available options are listed in green. Did you mean \`id\`?

    `)
  })
})
