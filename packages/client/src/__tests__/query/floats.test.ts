import { getDMMF } from '../../generation/getDMMF'
import { DMMFClass, makeDocument, transformDocument } from '../../runtime'

const datamodel = /* Prisma */ `
    datasource my_db {
        provider = "postgres"
        url      = env("POSTGRES_URL")
    }

    model Floats {
        id       Int    @id
        value    Float
    }
`

let dmmf

function getTransformedDocument(select) {
  const document = makeDocument({
    dmmf,
    select,
    rootTypeName: 'mutation',
    rootField: 'createOneFloats',
    extensions: [],
  })
  return String(transformDocument(document))
}

beforeAll(async () => {
  dmmf = new DMMFClass(await getDMMF({ datamodel }))
})

test('serializes floats in exponential notation', () => {
  const largeInt = getTransformedDocument({
    data: {
      value: 100_000_000_000_000_000_000,
    },
  })

  expect(largeInt).toMatchInlineSnapshot(`
    mutation {
      createOneFloats(data: {
        value: 1e+20
      }) {
        id
        value
      }
    }
  `)

  const negativeInt = getTransformedDocument({
    data: {
      value: Number.MIN_SAFE_INTEGER,
    },
  })

  expect(negativeInt).toMatchInlineSnapshot(`
    mutation {
      createOneFloats(data: {
        value: -9.007199254740991e+15
      }) {
        id
        value
      }
    }
  `)

  const otherFloat = getTransformedDocument({
    data: {
      value: 13.37,
    },
  })
  expect(otherFloat).toMatchInlineSnapshot(`
    mutation {
      createOneFloats(data: {
        value: 1.337e+1
      }) {
        id
        value
      }
    }
  `)
})
