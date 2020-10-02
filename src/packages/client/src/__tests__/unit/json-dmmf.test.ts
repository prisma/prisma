import { getDMMF } from '../../'

const datamodel = `datasource my_db {
  provider = "postgres"
  url      = env("POSTGRES_URL")
}

model User {
  id           String     @default(cuid()) @id
  field Json?
}
`

test('JsonFilter should contain equals and not', async () => {
  const dmmf = await getDMMF({ datamodel })

  expect(dmmf.schema.inputTypes).toMatchSnapshot()
})
