import { getDMMF } from '../generation/getDMMF'

const datamodel = `model User {
  id Int @id @default(autoincrement())
  name String
  email String @unique
  kind PostKind
}


enum PostKind {
  NICE
  AWESOME
}
`

describe('dmmf', () => {
  test('dmmf enum filter', async () => {
    const dmmf = await getDMMF({ datamodel })
    expect(
      dmmf.schema.inputTypes.find((i) => i.name === 'PostKindFilter'),
    ).toMatchInlineSnapshot(`undefined`)
  })
})
