import { IGQLType, GQLScalarField, ISDL } from 'prisma-datamodel'
import { isdlToDatamodel2 } from '../isdlToDatamodel2'
describe('isdlToDatamodel2', () => {
  test('simple type', async () => {
    const field1 = new GQLScalarField('hasBeenCreatedAt', 'DateTime')
    field1.isCreatedAt = true
    const field2 = new GQLScalarField('hasBeenUpdatedAt', 'DateTime')
    field2.isUpdatedAt = true
    const field3 = new GQLScalarField('primaryId', 'Int')
    field3.isId = true
    const field4 = new GQLScalarField('stringList', 'String')
    field4.isList = true

    const type: IGQLType = {
      name: 'Test',
      isEmbedded: false,
      isRelationTable: false,
      isEnum: false,
      fields: [field1, field2, field3, field4],
      comments: [],
      directives: [],
      databaseName: null,
      indices: [],
    }

    const isdl: ISDL = {
      types: [type],
    }

    const datamodel = await isdlToDatamodel2(isdl, [])
    expect(datamodel).toMatchInlineSnapshot(`
      "model Test {
        hasBeenCreatedAt DateTime? @default(now())
        hasBeenUpdatedAt DateTime? @updatedAt
        primaryId        Int?      @id
        stringList       String[]
      }"
    `)
  })
})
