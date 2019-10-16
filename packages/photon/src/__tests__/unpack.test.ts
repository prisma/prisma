import { blog } from '../fixtures/blog'
import { DMMFClass } from '../runtime'
import { getOutputType, makeDocument } from '../runtime/query'
import { getDMMF } from '../utils/getDMMF'

describe('getOutputType', () => {
  test('blog', async () => {
    const dmmfObj = await getDMMF({
      datamodel: blog,
    })
    const dmmf = new DMMFClass(dmmfObj)

    const document = makeDocument({
      dmmf,
      select: {
        select: {
          id: true,
          posts: true,
        },
      },
      rootTypeName: 'query',
      rootField: 'findOneUser',
    })

    const outputType = getOutputType({ dmmf, document, path: ['findOneUser', 'posts'] })
    expect(outputType.name).toMatchInlineSnapshot(`"Post"`)
  })
})
