import { replaceDatasource } from '../prompt/utils/replaceDatasource'
import { DataSource } from '@prisma/generator-helper'

const schema = `datasource db {
  provider = "sqlite"
  url      = "file:dev.db"
  default  = true
}

generator photon {
  provider = "photonjs"
}

model User {
  id    String  @default(cuid()) @id @unique
  email String  @unique
  name  String?
  posts Post[]
}

model Post {
  id        String   @default(cuid()) @id @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  published Boolean
  title     String
  content   String?
  author    User?
}`

test('simple replace', async () => {
  const datasource: DataSource = {
    name: 'db',
    url: { value: 'file:dev2.db', fromEnvVar: null },
    connectorType: 'sqlite',
    config: {},
  }
  const result = await replaceDatasource(schema, datasource)
  expect(result).toMatchInlineSnapshot(`
    "generator photon {
      provider = \\"photonjs\\"
    }

    datasource db {
      provider = \\"sqlite\\"
      url      = \\"file:dev2.db\\"
    }

    model User {
      id    String  @default(cuid()) @id @unique
      email String  @unique
      name  String?
      posts Post[]
    }

    model Post {
      id        String   @default(cuid()) @id @unique
      createdAt DateTime @default(now())
      updatedAt DateTime @updatedAt
      published Boolean
      title     String
      content   String?
      author    User?
    }"
  `)
})
