import chalk from 'chalk'
import { saleBuyers } from '../fixtures/saleBuyers'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { getDMMF } from '../generation/getDMMF'
chalk.level = 0

let dmmf
describe('minimal where transformation', () => {
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: saleBuyers }))
  })

  test('where OR not null', () => {
    const transformedDocument = getTransformedDocument({
      where: {
        OR: [
          {
            date: { not: null },
          },
        ],
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      "query {
        findManySale(where: {
          OR: [
            {
              date: {
                not: {
                  equals: null
                }
              }
            }
          ]
        }) {
          id
          date
        }
      }"
    `)
  })
})

function getTransformedDocument(select) {
  const document = makeDocument({
    dmmf,
    select,
    rootTypeName: 'query',
    rootField: 'findManySale',
  })
  return String(transformDocument(document))
}
