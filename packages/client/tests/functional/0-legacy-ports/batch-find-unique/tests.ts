import { copycat } from '@snaplet/copycat'

import { ProviderFlavors } from '../../_utils/providers'
import { waitFor } from '../../_utils/tests/waitFor'
import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient<{ log: [{ emit: 'event'; level: 'query' }] }>
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(({ providerFlavor }) => {
  beforeAll(async () => {
    prisma = newPrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    })

    await prisma.user.create({
      data: {
        id: copycat.uuid(0).replaceAll('-', '').slice(-24),
        email: copycat.email(1),
        age: 20,
      },
    })
    await prisma.user.create({
      data: {
        id: copycat.uuid(1).replaceAll('-', '').slice(-24),
        email: copycat.email(2),
        age: 45,
      },
    })
    await prisma.user.create({
      data: {
        id: copycat.uuid(2).replaceAll('-', '').slice(-24),
        email: copycat.email(3),
        age: 60,
      },
    })
    await prisma.user.create({
      data: {
        id: copycat.uuid(3).replaceAll('-', '').slice(-24),
        email: copycat.email(4),
        age: 63,
      },
    })

    await new Promise((r) => setTimeout(r, 1_000))
  })

  // TODO this test has to be skipped as is seems polluted by some state in a previous test or above, does not fail locally
  skipTestIf(providerFlavor === ProviderFlavors.JS_LIBSQL)('findUnique batching', async () => {
    // regex for 0wCIl-826241-1694134591596
    const mySqlSchemaIdRegex = /\w+-\d+-\d+/g
    let executedBatchQuery: string | undefined

    expect.assertions(2)

    prisma.$on('query', (event) => {
      executedBatchQuery = event.query.replace(mySqlSchemaIdRegex, '').trim()
    })

    const results = await Promise.all([
      prisma.user.findUnique({ where: { email: copycat.email(1) } }),
      prisma.user.findUnique({ where: { email: copycat.email(2) } }),
      prisma.user.findUnique({ where: { email: copycat.email(3) } }),
      prisma.user.findUnique({ where: { email: copycat.email(4) } }),
    ])

    await waitFor(() => {
      if (executedBatchQuery === undefined) {
        throw new Error('executedBatchQuery is undefined')
      }
    })

    expect(executedBatchQuery).toMatchSnapshot()

    expect(results).toMatchInlineSnapshot(`
      [
        {
          age: 20,
          email: Pete.Runte93767@broaden-dungeon.info,
          id: 341952ef935455f20a169c25,
          name: null,
        },
        {
          age: 45,
          email: Sam.Mills50272@oozeastronomy.net,
          id: 02d25579a73a72373fa4e846,
          name: null,
        },
        {
          age: 60,
          email: Kyla_Beer587@fraternise-assassination.name,
          id: a85d5d75a3a886cb61eb3a0e,
          name: null,
        },
        {
          age: 63,
          email: Arielle.Reichel85426@hunker-string.org,
          id: a7fe5dac91ab6b0f529430c5,
          name: null,
        },
      ]
    `)
  })
})
