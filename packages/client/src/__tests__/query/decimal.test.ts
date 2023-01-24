import { getDMMF } from '@prisma/internals'
import { Decimal } from 'decimal.js'

import { DMMFClass, makeDocument } from '../../runtime'
import { MergedExtensionsList } from '../../runtime/core/extensions/MergedExtensionsList'

const datamodel = /* Prisma */ `
    datasource my_db {
        provider = "postgres"
        url      = env("POSTGRES_URL")
    }

    model User {
        id       Int    @id
        money    Decimal
    }
`

let dmmf
beforeAll(async () => {
  dmmf = new DMMFClass(await getDMMF({ datamodel }))
})

test('allows to pass it decimal instance', () => {
  const document = makeDocument({
    dmmf,
    rootTypeName: 'query',
    rootField: 'findManyUser',
    select: { where: { money: new Decimal('123456789.12334') } },
    extensions: MergedExtensionsList.empty(),
  })

  expect(document.toString()).toMatchInlineSnapshot(`
    query {
      findManyUser(where: {
        money: "123456789.12334"
      }) {
        id
        money
      }
    }
  `)
  expect(() => document.validate()).not.toThrow()
})

test('allows to pass it a string', () => {
  const document = makeDocument({
    dmmf,
    rootTypeName: 'query',
    rootField: 'findManyUser',
    select: { where: { money: '123456789.12334' } },
    extensions: MergedExtensionsList.empty(),
  })

  expect(document.toString()).toMatchInlineSnapshot(`
    query {
      findManyUser(where: {
        money: "123456789.12334"
      }) {
        id
        money
      }
    }
  `)
  expect(() => document.validate()).not.toThrow()
})

test('allows to pass it a number', () => {
  const document = makeDocument({
    dmmf,
    rootTypeName: 'query',
    rootField: 'findManyUser',
    select: { where: { money: 12.3456 } },
    extensions: MergedExtensionsList.empty(),
  })

  expect(document.toString()).toMatchInlineSnapshot(`
    query {
      findManyUser(where: {
        money: 12.3456
      }) {
        id
        money
      }
    }
  `)
  expect(() => document.validate()).not.toThrow()
})

test('allows to pass it decimal-like object', () => {
  const document = makeDocument({
    dmmf,
    rootTypeName: 'query',
    rootField: 'findManyUser',
    select: {
      where: {
        money: {
          d: [12, 5000000],
          e: 1,
          s: 1,
        },
      },
    },
    extensions: MergedExtensionsList.empty(),
  })

  expect(document.toString()).toMatchInlineSnapshot(`
    query {
      findManyUser(where: {
        money: "12.5"
      }) {
        id
        money
      }
    }
  `)
  expect(() => document.validate()).not.toThrow()
})

test('allows to pass it decimal array', () => {
  const document = makeDocument({
    dmmf,
    rootTypeName: 'query',
    rootField: 'findManyUser',
    select: { where: { money: { in: [new Decimal('12.34'), new Decimal('56.78')] } } },
    extensions: MergedExtensionsList.empty(),
  })

  expect(document.toString()).toMatchInlineSnapshot(`
    query {
      findManyUser(where: {
        money: {
          in: [
            "12.34",
            "56.78"
          ]
        }
      }) {
        id
        money
      }
    }
  `)

  expect(() => document.validate()).not.toThrow()
})

test('allows to pass it decimal-like objects array', () => {
  const document = makeDocument({
    dmmf,
    rootTypeName: 'query',
    rootField: 'findManyUser',
    extensions: MergedExtensionsList.empty(),
    select: {
      where: {
        money: {
          in: [
            {
              d: [12, 3400000],
              e: 1,
              s: 1,
              toFixed: () => '12.34',
            },

            {
              d: [56, 7800000],
              e: 1,
              s: 1,
              toFixed: () => '56.78',
            },
          ],
        },
      },
    },
  })

  expect(document.toString()).toMatchInlineSnapshot(`
    query {
      findManyUser(where: {
        money: {
          in: [
            "12.34",
            "56.78"
          ]
        }
      }) {
        id
        money
      }
    }
  `)

  expect(() => document.validate()).not.toThrow()
})

test('allows to pass it string array', () => {
  const document = makeDocument({
    dmmf,
    rootTypeName: 'query',
    rootField: 'findManyUser',
    extensions: MergedExtensionsList.empty(),
    select: { where: { money: { in: ['12.34', '56.78'] } } },
  })

  expect(document.toString()).toMatchInlineSnapshot(`
    query {
      findManyUser(where: {
        money: {
          in: ["12.34", "56.78"]
        }
      }) {
        id
        money
      }
    }
  `)

  expect(() => document.validate()).not.toThrow()
})

test('allows to pass it number array', () => {
  const document = makeDocument({
    dmmf,
    rootTypeName: 'query',
    rootField: 'findManyUser',
    extensions: MergedExtensionsList.empty(),
    select: { where: { money: { in: [12.34, 56.78] } } },
  })

  expect(document.toString()).toMatchInlineSnapshot(`
    query {
      findManyUser(where: {
        money: {
          in: [12.34, 56.78]
        }
      }) {
        id
        money
      }
    }
  `)

  expect(() => document.validate()).not.toThrow()
})
