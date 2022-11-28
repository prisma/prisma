import { getDMMF } from '../generation/getDMMF'
import { DMMFClass, makeDocument } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/ExtensionsList'

const datamodel = `datasource my_db {
  provider = "postgres"
  url      = env("POSTGRES_URL")
}

model User {
  id      String   @default(cuid()) @id
  name    String
  hobbies String[]
}
`

describe('at least one validation', () => {
  let dmmf
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel }))
  })
  test('string first', () => {
    const select = {
      data: {
        hobbies: {
          set: [
            'sample 1 string',
            '7fb1aef9-5250-4cf6-92c7-b01f53862822',
            'sample 3 string',
            '575e0b28-81fa-43e0-8f05-708a98d55c14',
            'sample 5 string',
          ],
        },
        name: 'name',
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'mutation',
      rootField: 'createOneUser',
      extensions: MergedExtensionsList.empty(),
    })
    expect(() => document.validate(select, false)).not.toThrow()
  })
  test('uuid first', () => {
    const select = {
      data: {
        hobbies: {
          set: [
            '7fb1aef9-5250-4cf6-92c7-b01f53862822',
            'sample 3 string',
            '575e0b28-81fa-43e0-8f05-708a98d55c14',
            'sample 5 string',
          ],
        },
        name: 'name',
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'mutation',
      rootField: 'createOneUser',
      extensions: MergedExtensionsList.empty(),
    })
    expect(() => document.validate(select, false)).not.toThrow()
  })
})
