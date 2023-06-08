import { getDMMF } from '@prisma/internals'

import { singularRelation } from '../fixtures/singularRelation'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/MergedExtensionsList'

let dmmf
describe('minimal where transformation', () => {
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: singularRelation }))
  })

  test('where null', () => {
    const transformedDocument = getTransformedDocument({
      where: {
        company: null,
      },
    })

    expect(transformedDocument).toMatchInlineSnapshot(`
      query {
        findManyLocation(where: {
          company: null
        }) {
          id
          companyId
        }
      }
    `)
  })
})

function getTransformedDocument(select) {
  const document = makeDocument({
    dmmf,
    select,
    rootTypeName: 'query',
    rootField: 'findManyLocation',
    extensions: MergedExtensionsList.empty(),
  })
  return String(transformDocument(document))
}
