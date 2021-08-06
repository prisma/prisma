import chalk from 'chalk'
import { saleBuyers } from '../fixtures/saleBuyers'
import { DMMFClass, makeDocument } from '../runtime'
import { getDMMF } from '../generation/getDMMF'
chalk.level = 0

let dmmf
describe('minimal where transformation', () => {
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: saleBuyers }))
  })

  test('where OR not null', () => {
    const transformedDocument = getDocument({
      where: {
        OR: [
          {
            date: { not: null },
          },
        ],
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      query {
        findManySale(where: {
          OR: [
            {
              date: {
                not: null
              }
            }
          ]
        }) {
          id
          date
        }
      }
    `)
  })
})

function getDocument(select) {
  const document = makeDocument({
    dmmf,
    select,
    rootTypeName: 'query',
    rootField: 'findManySale',
  })
  return String(document)
}
