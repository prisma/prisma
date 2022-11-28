import chalk from 'chalk'

import { blog } from '../fixtures/blog'
import { getDMMF } from '../generation/getDMMF'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/ExtensionsList'

chalk.level = 0

describe('optional to one relation', () => {
  let dmmf
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel: blog }))
  })

  test('null query', () => {
    const select = {
      where: {
        author: null,
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'findManyPost',
      extensions: MergedExtensionsList.empty(),
    })

    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
      query {
        findManyPost(where: {
          author: null
        }) {
          id
          createdAt
          updatedAt
          published
          title
          content
          authorId
          optional
        }
      }
    `)
  })
})
