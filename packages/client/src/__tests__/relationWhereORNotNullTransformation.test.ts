import { getDMMF } from '@prisma/internals'

import { saleBuyers } from '../fixtures/saleBuyers'
import { DMMFClass, makeDocument } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/MergedExtensionsList'

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
    extensions: MergedExtensionsList.empty(),
  })
  return String(document)
}
