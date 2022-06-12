import fs from 'fs'
import path from 'path'
import sortKeys from 'sort-keys'

import { getDMMF } from '../generation/getDMMF'

const blog = `datasource db {
  provider = "postgres"
  url      = env("MY_POSTGRES_DB")
}

model Post {
  id        Int   @id @default(autoincrement())
  author    User  @relation(fields: [authorId], references: [id])
  authorId  Int
  title     String
  published Boolean @default(false)
}
model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  posts Post[]
}
`

test.skip('dmmf types', async () => {
  const dmmf = await getDMMF({ datamodel: blog })
  const file = `import { DMMF } from '@prisma/generator-helper'

const dmmf: DMMF.Document = ${JSON.stringify(sortKeys(dmmf, { deep: true }), null, 2)}
`
  const target = path.join(__dirname, '__helpers__/dmmf-types.ts')
  fs.writeFileSync(target, file)

  try {
    await import('./__helpers__/dmmf-types')
  } catch (e) {
    // we need to do this, as jest can't print the errors
    // resulting from the dynamic import
    console.error(e)
    throw e
  }
  expect(1).toBe(1)
})
