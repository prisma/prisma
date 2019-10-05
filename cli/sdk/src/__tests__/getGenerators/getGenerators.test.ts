import path from 'path'
import { getGenerators } from '../../getGenerators'

describe('getGenerators', () => {
  test('basic', async () => {
    const aliases = {
      'predefined-generator': path.join(__dirname, 'generator'),
    }

    const generators = await getGenerators(
      path.join(__dirname, 'schema.prisma'),
      aliases,
    )

    expect(generators.map(g => g.manifest)).toMatchInlineSnapshot()
  })
})
