import tempy from 'tempy'
import path from 'path'
import fs from 'fs'
import { promisify } from 'util'
import { Format } from '../Format'
import assert from 'assert'

const copyFile = promisify(fs.copyFile)

it('format should add a trailing EOL', async () => {
  const tmpDir = tempy.directory()
  const schemaTargetPath = path.join(tmpDir, 'schema.prisma')
  await copyFile(
    path.join(__dirname, 'fixtures/example-project/prisma/schema.prisma'),
    schemaTargetPath,
  )
  const cwd = process.cwd()
  process.chdir(tmpDir)

  const format = Format.new()
  await format.parse([])

  const schema = `generator client {
  provider = "prisma-client-js"
  output   = "../generated/client"
}

datasource db {
  provider = "sqlite"
  url      = "file:dev.db"
}

model Post {
  id        Int      @default(autoincrement()) @id
  createdAt DateTime @default(now())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
}

model Profile {
  id     Int     @default(autoincrement()) @id
  bio    String?
  user   User    @relation(fields: [userId], references: [id])
  userId Int     @unique
}

model User {
  id      Int      @default(autoincrement()) @id
  email   String   @unique
  name    String?
  posts   Post[]
  profile Profile?
}
`
  assert.equal(fs.readFileSync(schemaTargetPath, 'utf-8'), schema)

  process.chdir(cwd)
})
