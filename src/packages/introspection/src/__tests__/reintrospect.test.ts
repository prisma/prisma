import { Introspect } from '../commands/Introspect'
import path from 'path'

describe('introspect', () => {
  test('basic introspection', async () => {
    process.chdir(path.join(__dirname, 'fixture'))
    const introspect = new Introspect()
    const oldConsoleLog = console.log
    const logs: string[] = []
    console.log = (...args) => {
      logs.push(...args)
    }
    await introspect.parse(['--print'])
    console.log = oldConsoleLog
    expect(logs).toMatchInlineSnapshot(`
      Array [
        "generator client {
        provider = \\"prisma-client-js\\"
      }

      datasource db {
        provider = \\"sqlite\\"
        url      = \\"file:dev.db\\"
      }

      model Post {
        authorId  Int
        content   String?
        createdAt DateTime @default(now())
        id        Int      @default(autoincrement()) @id
        published Boolean  @default(false)
        title     String
        author    User     @relation(fields: [authorId], references: [id])
      }

      model Profile {
        bio    String?
        id     Int     @default(autoincrement()) @id
        userId Int     @unique
        user   User    @relation(fields: [userId], references: [id])
      }

      model User {
        email   String   @unique
        id      Int      @default(autoincrement()) @id
        name    String?
        posts   Post[]
        profile Profile?
      }
      ",
        "
      // introspectionSchemaVersion: Prisma2",
        "",
      ]
    `)
  })

  test('introspection --force', async () => {
    process.chdir(path.join(__dirname, 'fixture'))
    const introspect = new Introspect()
    const oldConsoleLog = console.log
    const logs: string[] = []
    console.log = (...args) => {
      logs.push(...args)
    }
    await introspect.parse(['--print', '--force'])
    console.log = oldConsoleLog
    expect(logs).toMatchInlineSnapshot(`
      Array [
        "generator client {
        provider = \\"prisma-client-js\\"
      }

      datasource db {
        provider = \\"sqlite\\"
        url      = \\"file:dev.db\\"
      }

      model Post {
        authorId  Int
        content   String?
        createdAt DateTime @default(now())
        id        Int      @default(autoincrement()) @id
        published Boolean  @default(false)
        title     String
        User      User     @relation(fields: [authorId], references: [id])
      }

      model Profile {
        bio    String?
        id     Int     @default(autoincrement()) @id
        userId Int     @unique
        User   User    @relation(fields: [userId], references: [id])
      }

      model User {
        email   String   @unique
        id      Int      @default(autoincrement()) @id
        name    String?
        Post    Post[]
        Profile Profile?
      }
      ",
        "
      // introspectionSchemaVersion: Prisma2",
        "",
      ]
    `)
  })

  test('basic introspection with --url', async () => {
    process.chdir(path.join(__dirname, 'fixture'))
    const introspect = new Introspect()
    const oldConsoleLog = console.log
    const logs: string[] = []
    console.log = (...args) => {
      logs.push(...args)
    }
    await introspect.parse(['--print', '--url', 'file:dev.db'])
    console.log = oldConsoleLog
    expect(logs).toMatchInlineSnapshot(`
      Array [
        "generator client {
        provider = \\"prisma-client-js\\"
      }

      datasource db {
        provider = \\"sqlite\\"
        url      = \\"file:dev.db\\"
      }

      model Post {
        authorId  Int
        content   String?
        createdAt DateTime @default(now())
        id        Int      @default(autoincrement()) @id
        published Boolean  @default(false)
        title     String
        author    User     @relation(fields: [authorId], references: [id])
      }

      model Profile {
        bio    String?
        id     Int     @default(autoincrement()) @id
        userId Int     @unique
        user   User    @relation(fields: [userId], references: [id])
      }

      model User {
        email   String   @unique
        id      Int      @default(autoincrement()) @id
        name    String?
        posts   Post[]
        profile Profile?
      }
      ",
        "
      // introspectionSchemaVersion: Prisma2",
        "",
      ]
    `)
  })
})
