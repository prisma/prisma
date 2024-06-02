import { copycat } from '@snaplet/copycat'

import { Providers } from '../../_utils/providers'
import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type $ from './node_modules/@prisma/client'

declare let prisma: $.PrismaClient<{ log: [{ emit: 'event'; level: 'query' }] }>
declare let newPrismaClient: NewPrismaClient<typeof $.PrismaClient>

const requiredJson = {
  foo: 'bar',
  bar: {
    baz: 'qux',
  },
  quux: ['corge', 'grault'],
  garply: [{ waldo: 'fred' }, { plugh: 'xyzzy' }],
}

// TODO: our json tests are not exhaustive
// ported from: blog
testMatrix.setupTestSuite(
  (suiteConfig) => {
    beforeAll(async () => {
      prisma = newPrismaClient({
        log: [{ emit: 'event', level: 'query' }],
      })

      prisma.$on('query', (e) => {
        console.log('Query: ' + e.query)
        console.log('Params: ' + e.params)
        console.log('Duration: ' + e.duration + 'ms')
      })

      await prisma.resource.deleteMany()

      // create unrelated entry so that test that want to filter down to specific entry actually fail if filters don't work
      await prisma.resource.create({
        data: {
          id: copycat.uuid(17).replaceAll('-', '').slice(-24),
          requiredJson: { foo: 'bar' },
        },
      })

      const result = await prisma.resource.create({
        data: {
          id: copycat.uuid(1).replaceAll('-', '').slice(-24),
          requiredJson,
        },
      })

      expect(result).toMatchInlineSnapshot(`
        {
          "id": "02d25579a73a72373fa4e846",
          "optionalJson": null,
          "requiredJson": {
            "bar": {
              "baz": "qux",
            },
            "foo": "bar",
            "garply": [
              {
                "waldo": "fred",
              },
              {
                "plugh": "xyzzy",
              },
            ],
            "quux": [
              "corge",
              "grault",
            ],
          },
        }
      `)
    })

    test('select required json', async () => {
      const result = await prisma.resource.findMany({
        select: {
          requiredJson: true,
        },
      })

      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('requiredJson')
    })

    testIf(['mysql', 'postgresql', 'cockroachdb'].includes(suiteConfig.provider))(
      'select required json with where equals and path',
      async () => {
        let result

        if (suiteConfig.provider === Providers.MYSQL) {
          result = await prisma.resource.findMany({
            where: {
              requiredJson: {
                // @ts-test-if: provider === Providers.MYSQL
                path: '$.bar.baz',
                equals: 'qux',
              },
            },
          })
        }

        if (suiteConfig.provider === Providers.POSTGRESQL || suiteConfig.provider === Providers.COCKROACHDB) {
          result = await prisma.resource.findMany({
            where: {
              requiredJson: {
                // @ts-test-if: provider === Providers.POSTGRESQL || provider === Providers.COCKROACHDB
                path: ['bar', 'baz'],
                equals: 'qux',
              },
            },
          })
        }

        expect(result).toHaveLength(1)
      },
    )

    test('select required json with where equals', async () => {
      const result = await prisma.resource.findMany({
        where: {
          requiredJson: {
            equals: requiredJson,
          },
        },
      })

      expect(result).toHaveLength(1)
    })

    test('select required json with where not equals', async () => {
      const result = await prisma.resource.findMany({
        where: {
          requiredJson: {
            not: requiredJson,
          },
        },
      })

      expect(result).toHaveLength(1)
      expect(result[0].requiredJson).toEqual({ foo: 'bar' })
    })

    test('update required json with where equals', async () => {
      const result = await prisma.resource.update({
        where: {
          id: copycat.uuid(1).replaceAll('-', '').slice(-24),
        },
        data: {
          requiredJson: {},
        },
      })

      expect(result).toMatchInlineSnapshot(`
        {
          "id": "02d25579a73a72373fa4e846",
          "optionalJson": null,
          "requiredJson": {},
        }
      `)
    })
  },
  {
    optOut: {
      from: ['sqlserver', 'sqlite'],
      reason: 'They do not support JSON',
    },
  },
)
