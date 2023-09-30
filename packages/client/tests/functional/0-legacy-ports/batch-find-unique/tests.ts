import { copycat } from '@snaplet/copycat'

import { ProviderFlavors } from '../../_utils/providers'
import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient<{ log: [{ emit: 'event'; level: 'query' }] }>
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

const email1 = copycat.email(51)
const email2 = copycat.email(2)
const email3 = copycat.email(23)
const email4 = copycat.email(44)

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
        id: copycat.uuid(10).replaceAll('-', '').slice(-24),
        email: email1,
        age: 20,
      },
    })
    await prisma.user.create({
      data: {
        id: copycat.uuid(41).replaceAll('-', '').slice(-24),
        email: email2,
        age: 45,
      },
    })
    await prisma.user.create({
      data: {
        id: copycat.uuid(28).replaceAll('-', '').slice(-24),
        email: email3,
        age: 60,
      },
    })
    await prisma.user.create({
      data: {
        id: copycat.uuid(93).replaceAll('-', '').slice(-24),
        email: email4,
        age: 63,
      },
    })

    await new Promise((r) => setTimeout(r, 1000))
  })

  // TODO this test has to be skipped as is seems polluted by some state in a previous test or above, does not fail locally
  skipTestIf(providerFlavor === ProviderFlavors.JS_LIBSQL)('findUnique batching', async () => {
    // regex for 0wCIl-826241-1694134591596
    const mySqlSchemaIdRegex = /\w+-\d+-\d+/g

    expect.assertions(2)

    prisma.$on('query', (event) => {
      expect(event.query.replace(mySqlSchemaIdRegex, '').trim()).toMatchSnapshot()
    })

    const results = await Promise.all([
      prisma.user.findUnique({ where: { email: email1 } }),
      prisma.user.findUnique({ where: { email: email2 } }),
      prisma.user.findUnique({ where: { email: email3 } }),
      prisma.user.findUnique({ where: { email: email4 } }),
    ])

    expect(results).toMatchInlineSnapshot(`
      [
        {
          age: 20,
          email: Katrina.Kerluke91513@mediumillusion.com,
          id: e1035a36b771b86ec5eb82a9,
          name: null,
        },
        {
          age: 45,
          email: Sam.Mills50272@oozeastronomy.net,
          id: efa355e5a0b1857a933bde51,
          name: null,
        },
        {
          age: 60,
          email: Christina_Mohr19867@pongregistry.org,
          id: 006b529d9c066b318dfc84e3,
          name: null,
        },
        {
          age: 63,
          email: Alva_Quitzon71654@worrisomemedium.org,
          id: b2625b09a5ec62b8d83fcd5b,
          name: null,
        },
      ]
    `)
  })
})
