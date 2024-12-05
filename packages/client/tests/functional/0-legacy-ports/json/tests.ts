import { copycat } from '@snaplet/copycat'

import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type $ from './node_modules/@prisma/client'

declare let prisma: $.PrismaClient

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
      await prisma.resource.deleteMany()
    })

    test('create required json', async () => {
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

      expect(result).toHaveLength(1)
      expect(result[0]).toHaveProperty('requiredJson')
    })

    testIf(['mysql', 'postgresql', 'cockroachdb'].includes(suiteConfig.provider))(
      'select required json with where path',
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

      expect(result).toHaveLength(0)
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
