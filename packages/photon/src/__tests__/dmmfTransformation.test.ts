import { blog } from '../fixtures/blog'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { getDMMF } from '../utils/getDMMF'

describe('dmmf transformation', () => {
  test('dmmf where attributes', async () => {
    const dmmf = await getDMMF({ datamodel: blog })
    debugger
  })
})
