import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite((suiteConfig, _suiteMeta, _clientMeta, cliMeta) => {
  // The query compiler runtime ships a pruned runtime datamodel
  // (no cardinality or requiredness) to keep bundles small; the
  // classic engine runtimes carry the full field metadata.
  const pruned = cliMeta.runtime === 'client'

  test('$provider reports the active datasource provider', () => {
    expect(prisma.$provider).toEqual(suiteConfig.provider)
  })

  test('$datamodel exposes models with field metadata', () => {
    const { models } = prisma.$datamodel

    expect(Object.keys(models)).toEqual(expect.arrayContaining(['User', 'Post']))

    const fields = Object.fromEntries(models.User.fields.map((field) => [field.name, field]))

    expect(fields.name).toMatchObject({ kind: 'scalar', type: 'String' })
    expect(fields.posts).toMatchObject({ kind: 'object', type: 'Post' })

    if (!pruned) {
      expect(fields.name).toMatchObject({ isList: false, isRequired: true })
      expect(fields.bio).toMatchObject({ isRequired: false })
      expect(fields.posts).toMatchObject({ isList: true })
    }
  })

  test('stays available on an extended client', () => {
    const extended = prisma.$extends({})

    expect(extended.$provider).toEqual(suiteConfig.provider)
    expect(Object.keys(extended.$datamodel.models)).toEqual(expect.arrayContaining(['User', 'Post']))
  })
})
