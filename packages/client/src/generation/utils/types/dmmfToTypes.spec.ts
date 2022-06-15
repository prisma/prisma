import { getDMMF } from '../../getDMMF'
import { dmmfToTypes } from './dmmfToTypes'

const schema = `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model User {
  id String @id
}
`

it('should get types without errors', async () => {
  const dmmf = await getDMMF({ datamodel: schema })
  const types = dmmfToTypes(dmmf)

  expect(types).toContain('PrismaClient<')
})
