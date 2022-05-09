import { Decimal } from 'decimal.js'

import { getDMMF } from '../../generation/getDMMF'
import { DMMFClass, makeDocument } from '../../runtime'

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
  })

  expect(document.toString()).toMatchInlineSnapshot(`
    query {
      findManyUser(where: {
        money: 123456789.12334
      }) {
        id
        money
      }
    }
  `)
})

test('allows to pass it decimal array', () => {
  const document = makeDocument({
    dmmf,
    rootTypeName: 'query',
    rootField: 'findManyUser',
    select: { where: { money: { in: [new Decimal('12.34'), new Decimal('56.78')] } } },
  })

  expect(document.toString()).toMatchInlineSnapshot(`
    query {
      findManyUser(where: {
        money: {
          in: [
            12.34,
            56.78
          ]
        }
      }) {
        id
        money
      }
    }
  `)
})
