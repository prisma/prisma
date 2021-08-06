import chalk from 'chalk'
import { singularRelation } from '../fixtures/singularRelation'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { getDMMF } from '../generation/getDMMF'
chalk.level = 0

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
  })
  return String(transformDocument(document))
}
