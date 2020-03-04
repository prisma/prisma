import { getGenerator, IntrospectionEngine } from '@prisma/sdk'
import { join, dirname } from 'path'
import mkdir from 'make-dir'
import { Client } from 'pg'
import assert from 'assert'
import pkgup from 'pkg-up'
import rimraf from 'rimraf'
import fs from 'fs'
import path from 'path'
import snapshot from 'snap-shot-it'
import { performance } from 'perf_hooks'
import { getLatestAlphaTag } from '@prisma/fetch-engine'

const connectionString = process.env.TEST_POSTGRES_URI || 'postgres://localhost:5432/prisma-dev'
process.env.SKIP_GENERATE = 'true'

const db = new Client({
  connectionString,
})

const pkg = pkgup.sync() || __dirname
const tmp = join(dirname(pkg), 'tmp-postgresql')
const engine = new IntrospectionEngine()
const latestAlphaPromise = getLatestAlphaTag()

before(done => {
  db.connect(err => done(err))
})

beforeEach(async () => {
  rimraf.sync(tmp)
  await mkdir(tmp)
})

after(async () => {
  await db.end()
  engine.stop()
})

const nameCache = {}

const prettyName = (fn: any): string => {
  const fnstr = fn.toString()
  const from = fnstr.indexOf('{')
  const to = fnstr.lastIndexOf('}')
  const sig = fnstr.slice(from + 1, to)
  const name = sig
    .replace(/\s{2,}/g, ' ')
    .replace('client.', '')
    .replace('return', '')
    .replace(/\n/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\r/g, ' ')
    .replace(';', '')
    .trim()

  if (nameCache[name]) {
    return name + 2
  }

  nameCache[name] = true

  return name
}

tests().map((t: Test) => {
  const name = prettyName(t.do)

  if (t.todo) {
    it.skip(name)
    return
  }

  it(name, async () => {
    try {
      await runTest(name, t)
    } catch (err) {
      throw err
    } finally {
      await db.query(t.down)
    }
  }).timeout(15000)
})

async function runTest(name: string, t: Test) {
  await db.query(t.down)
  await db.query(t.up)
  const schema = `
generator client {
  provider = "prisma-client-js"
  output   = "${tmp}"
}

datasource pg {
  provider = "postgresql"
  url = "${connectionString}"
}`
  const introspectionSchema = await engine.introspect(schema)
  snapshot(name, maskSchema(introspectionSchema))
  await generate(t, introspectionSchema)
  const prismaClientPath = join(tmp, 'index.js')
  const prismaClientDeclarationPath = join(tmp, 'index.d.ts')

  assert(fs.existsSync(prismaClientPath))
  assert(fs.existsSync(prismaClientDeclarationPath))

  // clear the require cache
  delete require.cache[prismaClientPath]
  const { PrismaClient } = await import(prismaClientPath)
  const prisma = new PrismaClient()
  await prisma.connect()
  try {
    const result = await t.do(prisma)
    await db.query(t.down)
    assert.deepEqual(result, t.expect)
  } catch (err) {
    throw err
  } finally {
    await prisma.disconnect()
  }
}

async function generate(test: Test, datamodel: string) {
  const schemaPath = path.join(tmp, 'schema.prisma')
  fs.writeFileSync(schemaPath, datamodel)

  const generator = await getGenerator({
    schemaPath,
    printDownloadProgress: false,
    baseDir: tmp,
    version: await latestAlphaPromise,
  })

  await generator.generate()

  generator.stop()
}

type Test = {
  title?: string
  todo?: boolean
  schema: string
  up: string
  down: string
  do: (client: any) => Promise<any>
  expect: any
}

function tests(): Test[] {
  return [
    {
      up: `
        create table teams (
          id int primary key not null,
          name text not null unique
        );
        insert into teams (id, name) values (1, 'a');
        insert into teams (id, name) values (2, 'b');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          id   Int    @id
          name String @unique
        }
      `,
      do: async client => {
        return client.teams.findOne({ where: { id: 2 } })
      },
      expect: {
        id: 2,
        name: 'b',
      },
    },
    {
      up: `
        create table teams (
          id int primary key not null,
          name text not null unique,
          email text not null unique
        );
        insert into teams (id, name, email) values (1, 'a', 'a@a');
        insert into teams (id, name, email) values (2, 'b', 'b@b');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          email String @unique
          id    Int    @id
          name  String @unique
        }
      `,
      do: async client => {
        return client.teams.findOne({ where: { id: 2 }, select: { name: true } })
      },
      expect: {
        name: 'b',
      },
    },
    {
      up: `
        create table users (
          id serial primary key not null,
          email text not null unique
        );
        create table posts (
          id serial primary key not null,
          user_id int not null references users (id) on update cascade,
          title text not null
        );
        insert into users ("email") values ('ada@prisma.io');
        insert into users ("email") values ('ema@prisma.io');
        insert into posts ("user_id", "title") values (1, 'A');
        insert into posts ("user_id", "title") values (1, 'B');
        insert into posts ("user_id", "title") values (2, 'C');
      `,
      down: `
        drop table if exists posts cascade;
        drop table if exists users cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          id      Int    @id
          title   String
          user_id users
        }

        model users {
          email String  @unique
          id    Int     @id
          posts posts[]
        }
      `,
      do: async client => {
        return client.users.findOne({ where: { id: 1 }, include: { posts: true } })
      },
      expect: {
        email: 'ada@prisma.io',
        id: 1,
        posts: [
          {
            id: 1,
            title: 'A',
          },
          {
            id: 2,
            title: 'B',
          },
        ],
      },
    },
    {
      up: `
        create table teams (
          id serial primary key not null,
          name text not null unique
        );
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          id   Int    @id
          name String @unique
        }
      `,
      do: async client => {
        return client.teams.create({ data: { name: 'c' } })
      },
      expect: {
        id: 1,
        name: 'c',
      },
    },
    {
      up: `
        create table teams (
          id serial primary key not null,
          name text not null default 'alice'
        );
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          id   Int    @id
          name String @default("alice")
        }
      `,
      do: async client => {
        return client.teams.create({ data: {} })
      },
      expect: {
        id: 1,
        name: 'alice',
      },
    },
    {
      todo: true,
      up: `
        create table teams (
          id serial primary key not null
        );
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          id Int @id
        }
      `,
      do: async client => {
        return client.teams.create({ data: {} })
      },
      expect: {
        id: 1,
        name: 'alice',
      },
    },
    {
      up: `
        create table teams (
          id serial primary key not null,
          name text not null unique
        );
        insert into teams ("name") values ('c');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          id   Int    @id
          name String @unique
        }
      `,
      do: async client => {
        return client.teams.update({
          where: { id: 1 },
          data: { name: 'd' },
        })
      },
      expect: {
        id: 1,
        name: 'd',
      },
    },
    {
      up: `
        create table teams (
          id serial primary key not null,
          name text not null unique,
          active boolean not null default true
        );
        insert into teams ("name") values ('c');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          active Boolean @default(true)
          id     Int     @id
          name   String  @unique
        }
      `,
      do: async client => {
        return client.teams.update({
          where: { id: 1 },
          data: { active: false },
        })
      },
      expect: {
        id: 1,
        name: 'c',
        active: false,
      },
    },
    {
      up: `
        create table teams (
          id serial primary key not null,
          name text not null unique,
          active boolean not null default true
        );
        insert into teams ("name") values ('c');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          active Boolean @default(true)
          id     Int     @id
          name   String  @unique
        }
      `,
      do: async client => {
        return client.teams.update({
          where: { id: 1 },
          data: { active: false },
          select: { active: true },
        })
      },
      expect: {
        active: false,
      },
    },
    {
      up: `
        create table teams (
          id serial primary key not null,
          name text not null unique
        );
        insert into teams ("name") values ('c');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          id   Int    @id
          name String @unique
        }
      `,
      do: async client => {
        return client.teams.update({
          where: { name: 'c' },
          data: { name: 'd' },
        })
      },
      expect: {
        id: 1,
        name: 'd',
      },
    },
    {
      up: `
        create table teams (
          id serial primary key not null,
          name text not null
        );
        insert into teams ("name") values ('c');
        insert into teams ("name") values ('c');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          id   Int    @id
          name String
        }
      `,
      do: async client => {
        return client.teams.updateMany({
          where: { name: 'c' },
          data: { name: 'd' },
        })
      },
      expect: {
        count: 2,
      },
    },
    {
      up: `
        create table teams (
          id serial primary key not null,
          name text not null
        );
        insert into teams ("name") values ('c');
        insert into teams ("name") values ('c');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          id   Int    @id
          name String
        }
      `,
      do: async client => {
        await client.teams.updateMany({
          where: { name: 'c' },
          data: { name: 'd' },
        })
        return client.teams.findMany()
      },
      expect: [
        {
          id: 1,
          name: 'd',
        },
        {
          id: 2,
          name: 'd',
        },
      ],
    },
    {
      up: `
        create table users (
          id serial primary key not null,
          email text not null unique
        );
        insert into users ("email") values ('ada@prisma.io');
      `,
      down: `
        drop table if exists users cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model users {
          email String @unique
          id    Int    @id
        }
      `,
      do: async client => {
        return client.users.findOne({ where: { email: 'ada@prisma.io' } })
      },
      expect: {
        id: 1,
        email: 'ada@prisma.io',
      },
    },
    {
      up: `
        create table users (
          id serial primary key not null,
          email text not null,
          name text not null,
          unique(email, name)
        );
        insert into users ("email", "name") values ('ada@prisma.io', 'Ada');
      `,
      down: `
        drop table if exists users cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model users {
          email String
          id    Int    @id
          name  String

          @@unique([email, name], name: "users_email_name_key")
        }
      `,
      do: async client => {
        return client.users.findOne({ where: { users_email_name_key: { email: 'ada@prisma.io', name: 'Ada' } } })
      },
      expect: {
        id: 1,
        email: 'ada@prisma.io',
        name: 'Ada',
      },
    },
    {
      up: `
        create table users (
          id serial primary key not null,
          email text not null,
          name text not null,
          unique(email, name)
        );
        insert into users ("email", "name") values ('ada@prisma.io', 'Ada');
      `,
      down: `
        drop table if exists users cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model users {
          email String
          id    Int    @id
          name  String

          @@unique([email, name], name: "users_email_name_key")
        }
      `,
      do: async client => {
        return client.users.update({
          where: { users_email_name_key: { email: 'ada@prisma.io', name: 'Ada' } },
          data: { name: 'Marco' },
        })
      },
      expect: {
        id: 1,
        email: 'ada@prisma.io',
        name: 'Marco',
      },
    },
    {
      up: `
        create table users (
          id serial primary key not null,
          email text not null,
          name text not null,
          unique(email, name)
        );
        insert into users ("email", "name") values ('ada@prisma.io', 'Ada');
      `,
      down: `
        drop table if exists users cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model users {
          email String
          id    Int    @id
          name  String

          @@unique([email, name], name: "users_email_name_key")
        }
      `,
      do: async client => {
        return client.users.delete({
          where: { users_email_name_key: { email: 'ada@prisma.io', name: 'Ada' } },
        })
      },
      expect: {
        id: 1,
        email: 'ada@prisma.io',
        name: 'Ada',
      },
    },
    {
      up: `
        create table users (
          id serial primary key not null,
          email text
        );
        insert into users ("email") values ('ada@prisma.io');
        insert into users ("email") values (null);
      `,
      down: `
        drop table if exists users cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model users {
          email String?
          id    Int     @id
        }
      `,
      do: async client => {
        return client.users.findMany()
      },
      expect: [
        {
          email: 'ada@prisma.io',
          id: 1,
        },
        {
          email: null,
          id: 2,
        },
      ],
    },
    {
      up: `
        create table users (
          id serial primary key not null,
          email text not null unique
        );
        insert into users ("email") values ('ada@prisma.io');
      `,
      down: `
        drop table if exists users cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model users {
          email String @unique
          id    Int    @id
        }
      `,
      do: async client => {
        return client.users.findMany({ where: { email: 'ada@prisma.io' } })
      },
      expect: [
        {
          id: 1,
          email: 'ada@prisma.io',
        },
      ],
    },

    {
      up: `
        create table users (
          id serial primary key not null,
          email text not null unique
        );
        insert into users ("email") values ('ada@prisma.io');
        insert into users ("email") values ('ema@prisma.io');
      `,
      down: `
        drop table if exists users cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model users {
          email String @unique
          id    Int    @id
        }
      `,
      do: async client => {
        return client.users.findMany()
      },
      expect: [
        {
          id: 1,
          email: 'ada@prisma.io',
        },
        {
          id: 2,
          email: 'ema@prisma.io',
        },
      ],
    },
    {
      up: `
        create table users (
          id serial primary key not null,
          email text not null unique
        );
        create table posts (
          id serial primary key not null,
          user_id int not null references users (id) on update cascade,
          title text not null
        );
        insert into users ("email") values ('ada@prisma.io');
        insert into users ("email") values ('ema@prisma.io');
        insert into posts ("user_id", "title") values (1, 'A');
        insert into posts ("user_id", "title") values (1, 'B');
        insert into posts ("user_id", "title") values (2, 'C');
      `,
      down: `
        drop table if exists posts cascade;
        drop table if exists users cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          id      Int    @id
          title   String
          user_id users
        }

        model users {
          email String  @unique
          id    Int     @id
          posts posts[]
        }
      `,
      do: async client => {
        return client.users.findOne({ where: { email: 'ada@prisma.io' } }).posts()
      },
      expect: [
        {
          id: 1,
          title: 'A',
        },
        {
          id: 2,
          title: 'B',
        },
      ],
    },
    {
      up: `
        create table posts (
          id serial primary key not null,
          title text not null,
          published boolean not null default false
        );
        insert into posts ("title", "published") values ('A', true);
        insert into posts ("title", "published") values ('B', false);
        insert into posts ("title", "published") values ('C', true);
      `,
      down: `
        drop table if exists posts cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          id        Int     @id
          published Boolean @default(false)
          title     String
        }
      `,
      do: async client => {
        return client.posts.findMany({
          where: {
            title: { contains: 'A' },
            published: true,
          },
        })
      },
      expect: [
        {
          id: 1,
          published: true,
          title: 'A',
        },
      ],
    },
    {
      up: `
        create table posts (
          id serial primary key not null,
          title text not null,
          published boolean not null default false
        );
        insert into posts ("title", "published") values ('A', true);
        insert into posts ("title", "published") values ('B', false);
        insert into posts ("title", "published") values ('C', true);
      `,
      down: `
        drop table if exists posts cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          id        Int     @id
          published Boolean @default(false)
          title     String
        }
      `,
      do: async client => {
        return client.posts.findMany({
          where: {
            OR: [{ title: { contains: 'A' } }, { title: { contains: 'C' } }],
            published: true,
          },
        })
      },
      expect: [
        {
          id: 1,
          published: true,
          title: 'A',
        },
        {
          id: 3,
          published: true,
          title: 'C',
        },
      ],
    },
    {
      up: `
        create table posts (
          id serial primary key not null,
          title text not null,
          published boolean not null default false
        );
        insert into posts ("title", "published") values ('A', true);
        insert into posts ("title", "published") values ('B', false);
        insert into posts ("title", "published") values ('C', true);
      `,
      down: `
        drop table if exists posts cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          id        Int     @id
          published Boolean @default(false)
          title     String
        }
      `,
      do: async client => {
        return client.posts.upsert({
          where: { id: 1 },
          create: { title: 'D', published: true },
          update: { title: 'D', published: true },
        })
      },
      expect: {
        id: 1,
        published: true,
        title: 'D',
      },
    },
    {
      up: `
        create table posts (
          id serial primary key not null,
          title text not null,
          published boolean not null default false
        );
        insert into posts ("title", "published") values ('A', true);
        insert into posts ("title", "published") values ('B', false);
        insert into posts ("title", "published") values ('C', true);
      `,
      down: `
        drop table if exists posts cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          id        Int     @id
          published Boolean @default(false)
          title     String
        }
      `,
      do: async client => {
        return client.posts.upsert({
          where: { id: 4 },
          create: { title: 'D', published: false },
          update: { title: 'D', published: true },
        })
      },
      expect: {
        id: 4,
        published: false,
        title: 'D',
      },
    },
    {
      up: `
        create table posts (
          id serial primary key not null,
          title text not null,
          published boolean not null default false
        );
        insert into posts ("title", "published") values ('A', true);
        insert into posts ("title", "published") values ('B', false);
        insert into posts ("title", "published") values ('C', true);
      `,
      down: `
        drop table if exists posts cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          id        Int     @id
          published Boolean @default(false)
          title     String
        }
      `,
      do: async client => {
        return client.posts.findMany({
          orderBy: {
            title: 'asc',
          },
        })
      },
      expect: [
        {
          id: 1,
          published: true,
          title: 'A',
        },
        {
          id: 2,
          published: false,
          title: 'B',
        },
        {
          id: 3,
          published: true,
          title: 'C',
        },
      ],
    },
    {
      up: `
        create table posts (
          id serial primary key not null,
          title text not null,
          published boolean not null default false
        );
        insert into posts ("title", "published") values ('A', true);
        insert into posts ("title", "published") values ('B', false);
        insert into posts ("title", "published") values ('C', true);
      `,
      down: `
        drop table if exists posts cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          id        Int     @id
          published Boolean @default(false)
          title     String
        }
      `,
      do: async client => {
        return client.posts.findMany({
          orderBy: {
            title: 'desc',
          },
        })
      },
      expect: [
        {
          id: 3,
          published: true,
          title: 'C',
        },
        {
          id: 2,
          published: false,
          title: 'B',
        },
        {
          id: 1,
          published: true,
          title: 'A',
        },
      ],
    },
    {
      up: `
        create type posts_status as enum ('DRAFT','PUBLISHED');
        create table posts (
          id serial primary key not null,
          title text not null,
          published posts_status not null default 'DRAFT'
        );
        insert into posts ("title") values ('A');
        insert into posts ("title") values ('B');
        insert into posts ("title") values ('C');
      `,
      down: `
        drop table if exists posts cascade;
        drop type if exists posts_status cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          id        Int          @id
          published posts_status
          title     String
        }

        enum posts_status {
          DRAFT
          PUBLISHED
        }
      `,
      do: async client => {
        return client.posts.findMany()
      },
      expect: [
        {
          id: 1,
          published: 'DRAFT',
          title: 'A',
        },
        {
          id: 2,
          published: 'DRAFT',
          title: 'B',
        },
        {
          id: 3,
          published: 'DRAFT',
          title: 'C',
        },
      ],
    },
    {
      todo: true,
      up: `
        create type posts_status as enum ('DRAFT','PUBLISHED');
        create table posts (
          id serial primary key not null,
          title text not null,
          published posts_status not null default 'DRAFT'
        );
        insert into posts ("title") values ('A');
        insert into posts ("title") values ('B');
        insert into posts ("title") values ('C');
      `,
      down: `
        drop table if exists posts cascade;
        drop type if exists posts_status cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          id        Int          @id
          published posts_status
          title     String
        }

        enum posts_status {
          DRAFT
          PUBLISHED
        }
      `,
      do: async client => {
        return client.posts.create({ data: { title: 'D' } })
      },
      expect: {},
    },
    {
      up: `
        create type posts_status as enum ('DRAFT','PUBLISHED');
        create table posts (
          id serial primary key not null,
          title text not null,
          published posts_status not null default 'DRAFT'
        );
        insert into posts ("title") values ('A');
        insert into posts ("title") values ('B');
        insert into posts ("title") values ('C');
      `,
      down: `
        drop table if exists posts cascade;
        drop type if exists posts_status cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          id        Int          @id
          published posts_status
          title     String
        }

        enum posts_status {
          DRAFT
          PUBLISHED
        }
      `,
      do: async client => {
        return client.posts.update({
          where: { id: 1 },
          data: { published: 'PUBLISHED' },
        })
      },
      expect: {
        id: 1,
        published: 'PUBLISHED',
        title: 'A',
      },
    },
    {
      up: `
        create type posts_status as enum ('DRAFT','PUBLISHED');
        create table posts (
          id serial primary key not null,
          title text not null,
          published posts_status not null default 'DRAFT'
        );
        insert into posts ("title") values ('A');
        insert into posts ("title") values ('B');
        insert into posts ("title") values ('C');
      `,
      down: `
        drop table if exists posts cascade;
        drop type if exists posts_status cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          id        Int          @id
          published posts_status
          title     String
        }

        enum posts_status {
          DRAFT
          PUBLISHED
        }
      `,
      do: async client => {
        return client.posts.updateMany({
          data: { published: 'PUBLISHED' },
        })
      },
      expect: {
        count: 3,
      },
    },
    {
      up: `
        create type posts_status as enum ('DRAFT','PUBLISHED');
        create table posts (
          id serial primary key not null,
          title text not null,
          published posts_status not null default 'DRAFT'
        );
        insert into posts ("title") values ('A');
        insert into posts ("title") values ('B');
        insert into posts ("title") values ('C');
      `,
      down: `
        drop table if exists posts cascade;
        drop type if exists posts_status cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          id        Int          @id
          published posts_status
          title     String
        }

        enum posts_status {
          DRAFT
          PUBLISHED
        }
      `,
      do: async client => {
        await client.posts.updateMany({
          data: { published: 'PUBLISHED' },
        })
        return client.posts.findMany()
      },
      expect: [
        {
          id: 1,
          published: 'PUBLISHED',
          title: 'A',
        },
        {
          id: 2,
          published: 'PUBLISHED',
          title: 'B',
        },
        {
          id: 3,
          published: 'PUBLISHED',
          title: 'C',
        },
      ],
    },
    {
      up: `
        create type posts_status as enum ('DRAFT','PUBLISHED');
        create table posts (
          id serial primary key not null,
          title text not null,
          published posts_status not null default 'DRAFT'
        );
        insert into posts ("title") values ('A');
        insert into posts ("title") values ('B');
        insert into posts ("title","published") values ('C', 'PUBLISHED');
      `,
      down: `
        drop table if exists posts cascade;
        drop type if exists posts_status cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          id        Int          @id
          published posts_status
          title     String
        }

        enum posts_status {
          DRAFT
          PUBLISHED
        }
      `,
      do: async client => {
        return await client.posts.deleteMany({
          where: { published: 'DRAFT' },
        })
      },
      expect: {
        count: 2,
      },
    },
    {
      up: `
        create type posts_status as enum ('DRAFT','PUBLISHED');
        create table posts (
          id serial primary key not null,
          title text not null,
          published posts_status not null default 'DRAFT'
        );
        insert into posts ("title") values ('A');
        insert into posts ("title") values ('B');
        insert into posts ("title","published") values ('C', 'PUBLISHED');
      `,
      down: `
        drop table if exists posts cascade;
        drop type if exists posts_status cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          id        Int          @id
          published posts_status
          title     String
        }

        enum posts_status {
          DRAFT
          PUBLISHED
        }
      `,
      do: async client => {
        await client.posts.deleteMany({
          where: { published: 'DRAFT' },
        })
        return client.posts.findMany()
      },
      expect: [
        {
          id: 3,
          published: 'PUBLISHED',
          title: 'C',
        },
      ],
    },
    {
      up: `
        create table crons (
          id serial not null primary key,
          "job" text unique not null,
          frequency text
        );
        insert into crons ("job", "frequency") values ('j1', '* * * * *');
        insert into crons ("job", "frequency") values ('j20', '* * * * 1-5');
        insert into crons ("job", "frequency") values ('j21', '* * * * 1-5');
      `,
      down: `
        drop table if exists crons cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model crons {
          frequency String?
          id        Int     @id
          job       String  @unique
        }
      `,
      do: async client => {
        return client.crons.findMany({ where: { job: { contains: 'j2' } } })
      },
      expect: [
        {
          frequency: '* * * * 1-5',
          id: 2,
          job: 'j20',
        },
        {
          frequency: '* * * * 1-5',
          id: 3,
          job: 'j21',
        },
      ],
    },
    {
      up: `
        create table crons (
          id serial not null primary key,
          "job" text unique not null,
          frequency text
        );
        insert into crons ("job", "frequency") values ('j1', '* * * * *');
        insert into crons ("job", "frequency") values ('j20', '* * * * 1-5');
        insert into crons ("job", "frequency") values ('j21', '* * * * 1-5');
      `,
      down: `
        drop table if exists crons cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model crons {
          frequency String?
          id        Int     @id
          job       String  @unique
        }
      `,
      do: async client => {
        return client.crons.findMany({ where: { job: { startsWith: 'j2' } } })
      },
      expect: [
        {
          frequency: '* * * * 1-5',
          id: 2,
          job: 'j20',
        },
        {
          frequency: '* * * * 1-5',
          id: 3,
          job: 'j21',
        },
      ],
    },
    {
      up: `
        create table crons (
          id serial not null primary key,
          "job" text unique not null,
          frequency text
        );
        insert into crons ("job", "frequency") values ('j1', '* * * * *');
        insert into crons ("job", "frequency") values ('j20', '* * * * 1-5');
        insert into crons ("job", "frequency") values ('j21', '* * * * 1-5');
      `,
      down: `
        drop table if exists crons cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model crons {
          frequency String?
          id        Int     @id
          job       String  @unique
        }
      `,
      do: async client => {
        return client.crons.findMany({ where: { job: { endsWith: '1' } } })
      },
      expect: [
        {
          frequency: '* * * * *',
          id: 1,
          job: 'j1',
        },
        {
          frequency: '* * * * 1-5',
          id: 3,
          job: 'j21',
        },
      ],
    },
    {
      up: `
        create table crons (
          id serial not null primary key,
          "job" text unique not null,
          frequency text
        );
        insert into crons ("job", "frequency") values ('j1', '* * * * *');
        insert into crons ("job", "frequency") values ('j20', '* * * * 1-5');
        insert into crons ("job", "frequency") values ('j21', '* * * * 1-5');
      `,
      down: `
        drop table if exists crons cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model crons {
          frequency String?
          id        Int     @id
          job       String  @unique
        }
      `,
      do: async client => {
        return client.crons.findMany({ where: { job: { in: ['j20', 'j1'] } } })
      },
      expect: [
        {
          frequency: '* * * * *',
          id: 1,
          job: 'j1',
        },
        {
          frequency: '* * * * 1-5',
          id: 2,
          job: 'j20',
        },
      ],
    },
    {
      todo: true,
      up: `
        create table crons (
          id serial not null primary key,
          "job" text unique not null,
          frequency text
        );
        insert into crons ("job", "frequency") values ('j1', '* * * * *');
        insert into crons ("job", "frequency") values ('j20', '* * * * 1-5');
        insert into crons ("job", "frequency") values ('j21', '* * * * 1-5');
      `,
      down: `
        drop table if exists crons cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model crons {
          frequency String?
          id        Int     @id
          job       String  @unique
        }
      `,
      do: async client => {
        return client.crons.findOne({ where: { job: { in: ['j20', 'j1'] } } })
      },
      expect: [
        {
          frequency: '* * * * *',
          id: 1,
          job: 'j1',
        },
        {
          frequency: '* * * * 1-5',
          id: 2,
          job: 'j20',
        },
      ],
    },
    {
      up: `
        create table posts (
          id serial primary key not null,
          title text not null,
          created_at timestamp not null default now()
        );
        insert into posts ("title", "created_at") values ('A', '2020-01-14T11:10:19.573Z');
        insert into posts ("title", "created_at") values ('B', '2020-01-14T11:10:19.573Z');
        insert into posts ("title", "created_at") values ('C', '2020-01-14T11:10:19.573Z');
      `,
      down: `
        drop table if exists posts cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          created_at DateTime
          id         Int      @id
          title      String
        }
      `,
      // todo: true,
      do: async client => {
        const posts = await client.posts.findMany({ where: { created_at: { lte: new Date() } } })
        posts.forEach(post => {
          assert.ok(post.created_at instanceof Date)
          delete post.created_at
        })
        return posts
      },
      expect: [
        {
          id: 1,
          title: 'A',
        },
        {
          id: 2,
          title: 'B',
        },
        {
          id: 3,
          title: 'C',
        },
      ],
    },
    {
      // todo: true,
      up: `
        create table posts (
          id serial primary key not null,
          title text not null,
          created_at timestamp not null default now()
        );
        insert into posts ("title", "created_at") values ('A', '2020-01-14T11:10:19.573Z');
        insert into posts ("title", "created_at") values ('B', '2020-01-14T11:10:19.573Z');
        insert into posts ("title", "created_at") values ('C', '2020-01-14T11:10:19.573Z');
      `,
      down: `
        drop table if exists posts cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          created_at DateTime
          id         Int      @id
          title      String
        }
      `,
      do: async client => {
        return client.posts.findMany({ where: { created_at: { gte: new Date() } } })
      },
      expect: [],
    },
    {
      // todo: true,
      up: `
        create table posts (
          id serial primary key not null,
          title text not null,
          created_at timestamp not null default now()
        );
        insert into posts ("title", "created_at") values ('A', '2020-01-14T11:10:19.573Z');
        insert into posts ("title", "created_at") values ('B', '2020-01-14T11:10:19.573Z');
        insert into posts ("title", "created_at") values ('C', '2020-01-14T11:10:19.573Z');
      `,
      down: `
        drop table if exists posts cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          created_at DateTime
          id         Int      @id
          title      String
        }
      `,
      do: async client => {
        return client.posts.findMany({ where: { created_at: { gt: new Date() } } })
      },
      expect: [],
    },
    {
      // todo: true,
      up: `
        create table posts (
          id serial primary key not null,
          title text not null,
          created_at timestamp not null default now()
        );
        insert into posts ("title", "created_at") values ('A', '2020-01-14T11:10:19.573Z');
        insert into posts ("title", "created_at") values ('B', '2020-01-14T11:10:19.573Z');
        insert into posts ("title", "created_at") values ('C', '2020-01-14T11:10:19.573Z');
      `,
      down: `
        drop table if exists posts cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model posts {
          created_at DateTime
          id         Int      @id
          title      String
        }
      `,
      do: async client => {
        const posts = await client.posts.findMany({ where: { created_at: { lt: new Date() } } })
        posts.forEach(post => {
          assert.ok(post.created_at instanceof Date)
          delete post.created_at
        })
        return posts
      },
      expect: [
        {
          id: 1,
          title: 'A',
        },
        {
          id: 2,
          title: 'B',
        },
        {
          id: 3,
          title: 'C',
        },
      ],
    },
    {
      todo: true,
      up: `
        create table teams (
          id serial primary key not null,
          token integer unique not null
        );
        insert into teams (token) values (11);
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          id    Int @id
          token Int @unique
        }
      `,
      do: async client => {
        return client.teams.update({ where: { token: 11 }, data: { token: 10 } })
      },
      expect: {
        id: 1,
        token: 10,
      },
    },
    {
      todo: true,
      up: `
        create table events (
          id serial not null primary key,
          "time" timestamp with time zone
        );
        insert into events ("time") values ('2018-09-04 00:00:00+00');
      `,
      down: `
        drop table if exists events cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model events {
          id   Int       @id
          time DateTime?
        }
      `,
      do: async client => {
        return client.events.findMany({ where: { time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } })
      },
      expect: {
        id: 1,
        token: 10,
      },
    },
    {
      todo: true,
      up: `
        create table events (
          id serial not null primary key,
          "time" timestamp with time zone
        );
        insert into events ("time") values ('2018-09-04 00:00:00+00');
      `,
      down: `
        drop table if exists events cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model events {
          id   Int       @id
          time DateTime?
        }
      `,
      do: async client => {
        return client.events.find({ where: { time: { gt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })
      },
      expect: {
        id: 1,
        token: 10,
      },
    },
    {
      todo: true,
      up: `
        create table events (
          id serial not null primary key,
          "time" timestamp with time zone
        );
        insert into events ("time") values ('2018-09-04 00:00:00+00');
      `,
      down: `
        drop table if exists events cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model events {
          id   Int       @id
          time DateTime?
        }
      `,
      do: async client => {
        return client.events.find({ where: { time: { gte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })
      },
      expect: {
        id: 1,
        token: 10,
      },
    },
    {
      todo: true,
      up: `
        create table events (
          id serial not null primary key,
          "time" timestamp with time zone
        );
        insert into events ("time") values ('2018-09-04 00:00:00+00');
      `,
      down: `
        drop table if exists events cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model events {
          id   Int       @id
          time DateTime?
        }
      `,
      do: async client => {
        return client.events.find({ where: { time: { lt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })
      },
      expect: {
        id: 1,
        token: 10,
      },
    },
    {
      todo: true,
      up: `
        create table events (
          id serial not null primary key,
          "time" timestamp with time zone
        );
        insert into events ("time") values ('2018-09-04 00:00:00+00');
      `,
      down: `
        drop table if exists events cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model events {
          id   Int       @id
          time DateTime?
        }
      `,
      do: async client => {
        return client.events.find({ where: { time: { lte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })
      },
      expect: {
        id: 1,
        token: 10,
      },
    },
    {
      todo: true,
      up: `
        create table events (
          id serial not null primary key,
          "time" timestamp with time zone
        );
        insert into events ("time") values ('2018-09-04 00:00:00+00');
      `,
      down: `
        drop table if exists events cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model events {
          id   Int       @id
          time DateTime?
        }
      `,
      do: async client => {
        return client.events.findMany({ where: { time: { not: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })
      },
      expect: {
        id: 1,
        token: 10,
      },
    },
    {
      todo: true,
      up: `
        create table events (
          id serial not null primary key,
          "time" timestamp with time zone
        );
        insert into events ("time") values (NULL);
        insert into events ("time") values (NULL);
        insert into events ("time") values (NULL);
      `,
      down: `
        drop table if exists events cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model events {
          id   Int       @id
          time DateTime?
        }
      `,
      do: async client => {
        return client.events.findMany({ where: { time: null } })
      },
      expect: [],
    },
    {
      up: `
        create table teams (
          id serial primary key not null,
          token integer unique not null,
          name text not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          id    Int    @id
          name  String
          token Int    @unique
        }
      `,
      do: async client => {
        return client.teams.findMany({ where: { id: { in: [] } } })
      },
      expect: [],
    },
    {
      up: `
        create table teams (
          id serial primary key not null,
          token integer unique not null,
          name text not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          id    Int    @id
          name  String
          token Int    @unique
        }
      `,
      do: async client => {
        return client.teams.findMany({ where: { id: { in: [] }, token: { in: [11, 22] } } })
      },
      expect: [],
    },
    {
      up: `
        create table teams (
          id serial primary key not null,
          token integer unique not null,
          name text not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          id    Int    @id
          name  String
          token Int    @unique
        }
      `,
      do: async client => {
        return client.teams.findMany({ where: { token: { in: [11, 22] } } })
      },
      expect: [
        {
          id: 1,
          name: 'a',
          token: 11,
        },
        {
          id: 2,
          name: 'b',
          token: 22,
        },
      ],
    },
    {
      up: `
        create table teams (
          id serial primary key not null,
          token integer unique not null,
          name text not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          id    Int    @id
          name  String
          token Int    @unique
        }
      `,
      do: async client => {
        return client.teams.findMany({ where: { token: { notIn: [11, 22] } } })
      },
      expect: [],
    },
    {
      up: `
        create table teams (
          id serial primary key not null,
          token integer unique not null,
          name text not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          id    Int    @id
          name  String
          token Int    @unique
        }
      `,
      do: async client => {
        return client.teams.findMany({ where: { token: { notIn: [] } } })
      },
      expect: [
        {
          id: 1,
          name: 'a',
          token: 11,
        },
        {
          id: 2,
          name: 'b',
          token: 22,
        },
      ],
    },
    {
      todo: true,
      up: `
        create table teams (
          id serial primary key not null,
          token integer unique not null,
          name text not null
        );
        create table users (
          id serial primary key not null,
          email text not null unique,
          team_id int references teams (id)
        );
        insert into teams ("token", "name") values (1, 'a');
        insert into users ("email", team_id) values ('a', NULL);
        insert into users ("email", "team_id") values ('b', 1);
      `,
      down: `
        drop table if exists users cascade;
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          id      Int     @id
          name    String
          token   Int     @unique
          userses users[] @relation(references: [team_id])
        }

        model users {
          email   String @unique
          id      Int    @id
          team_id teams?
        }
      `,
      do: async client => {
        return client.users.findMany({ where: { team_id: null } })
      },
      expect: [
        {
          email: 'a',
          id: 1,
        },
      ],
    },
    {
      up: `
        create extension citext;
        create table users (
          id serial primary key not null,
          email citext not null unique
        );
        insert into users ("email") values ('max@prisma.io');
      `,
      down: `
        drop table if exists users cascade;
        drop extension if exists citext cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model users {
          email String @unique
          id    Int    @id
        }
      `,
      do: async client => {
        return client.users.findMany({ where: { email: 'MAX@PRISMA.IO' } })
      },
      expect: [
        {
          email: 'max@prisma.io',
          id: 1,
        },
      ],
    },
    {
      up: `
        create table exercises (
          id serial primary key not null,
          distance decimal(5, 3) not null
        );
        insert into exercises (distance) values (12.213);
      `,
      down: `
        drop table if exists exercises cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model exercises {
          distance Float
          id       Int   @id
        }
      `,
      do: async client => {
        return client.exercises.findMany({ where: { distance: 12.213 } })
      },
      expect: [
        {
          distance: 12.213,
          id: 1,
        },
      ],
    },
    {
      up: `
        create table exercises (
          id serial primary key not null,
          distance decimal(5, 3) not null unique
        );
        insert into exercises (distance) values (12.213);
      `,
      down: `
        drop table if exists exercises cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model exercises {
          distance Float @unique
          id       Int   @id
        }
      `,
      do: async client => {
        return client.exercises.findOne({ where: { distance: 12.213 } })
      },
      expect: {
        distance: 12.213,
        id: 1,
      },
    },
    {
      up: `
        create table exercises (
          id serial primary key not null,
          distance decimal(5, 3) not null unique default (12.3)
        );
        insert into exercises (distance) values (12.213);
        insert into exercises (id) values (2);
      `,
      down: `
        drop table if exists exercises cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model exercises {
          distance Float @default(12.3) @unique
          id       Int   @id
        }
      `,
      do: async client => {
        return client.exercises.findOne({ where: { distance: 12.3 } })
      },
      expect: {
        distance: 12.3,
        id: 2,
      },
    },
    {
      up: `
        create table migrate (
          version bigint not null primary key
        );
      `,
      down: `
        drop table if exists migrate cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model migrate {
          version Int @id
        }
      `,
      do: async client => {
        return client.migrate.create({ data: { version: 1 } })
      },
      expect: {
        version: 1,
      },
    },
    {
      todo: true,
      up: `
        create table variables (
          name text not null,
          key text not null,
          value text not null,
          email text not null,
          primary key(name, key)
        );
        insert into variables (name, key, value, email) values ('a', 'b', 'c', 'd');
      `,
      down: `
        drop table if exists variables cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model variables {
          email String
          key   String
          name  String
          value String

          @@id([name, key])
        }
      `,
      do: async client => {
        return client.variables.findOne({ where: { variables_name_key_key: { key: 'b', name: 'a' } } })
      },
      expect: {}, // TODO
    },
    {
      todo: true,
      up: `
        create table variables (
          name text not null,
          key text not null,
          value text not null,
          email text not null,
          primary key(name, key)
        );
        insert into variables (name, key, value, email) values ('a', 'b', 'c', 'd');
      `,
      down: `
        drop table if exists variables cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model variables {
          email String
          key   String
          name  String
          value String

          @@id([name, key])
        }
      `,
      do: async client => {
        return client.variables.update({
          where: { variables_name_key_key: { key: 'b', name: 'a' } },
          data: { email: 'e' },
        })
      },
      expect: {}, // TODO
    },
    {
      todo: true,
      up: `
        create table variables (
          name text not null,
          key text not null,
          value text not null,
          email text not null,
          primary key(name, key)
        );
        insert into variables (name, key, value, email) values ('a', 'b', 'c', 'd');
      `,
      down: `
        drop table if exists variables cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model variables {
          email String
          key   String
          name  String
          value String

          @@id([name, key])
        }
      `,
      do: async client => {
        return client.variables.upsert({
          where: { variables_name_key_key: { key: 'b', name: 'a' } },
          create: {}, // TODO
          update: {}, // TODO
        })
      },
      expect: {}, // TODO
    },
    {
      todo: true,
      up: `
        create table variables (
          name text not null,
          key text not null,
          value text not null,
          email text not null,
          primary key(name, key)
        );
        insert into variables (name, key, value, email) values ('a', 'b', 'c', 'd');
      `,
      down: `
        drop table if exists variables cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model variables {
          email String
          key   String
          name  String
          value String

          @@id([name, key])
        }
      `,
      do: async client => {
        return client.variables.delete({
          where: { variables_name_key_key: { key: 'b', name: 'a' } },
        })
      },
      expect: {}, // TODO
    },
    {
      up: `
        create table variables (
          id serial primary key not null,
          name text not null,
          key text not null,
          value text not null,
          email text not null,
          unique(name, key)
        );
        insert into variables (name, key, value, email) values ('a', 'b', 'c', 'd');
      `,
      down: `
        drop table if exists variables cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model variables {
          email String
          id    Int    @id
          key   String
          name  String
          value String

          @@unique([name, key], name: "variables_name_key_key")
        }
      `,
      do: async client => {
        return client.variables.findOne({ where: { variables_name_key_key: { key: 'b', name: 'a' } } })
      },
      expect: {
        email: 'd',
        id: 1,
        key: 'b',
        name: 'a',
        value: 'c',
      },
    },
    {
      up: `
        create table variables (
          name text not null,
          key text not null,
          value text not null,
          email text not null,
          primary key(name, key),
          unique(value, email)
        );
        insert into variables (name, key, value, email) values ('a', 'b', 'c', 'd');
      `,
      down: `
        drop table if exists variables cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model variables {
          email String
          key   String
          name  String
          value String

          @@id([name, key])
          @@unique([value, email], name: "variables_value_email_key")
        }
      `,
      do: async client => {
        return client.variables.findOne({ where: { variables_value_email_key: { value: 'c', email: 'd' } } })
      },
      expect: {
        email: 'd',
        key: 'b',
        name: 'a',
        value: 'c',
      },
    },
    {
      todo: true,
      up: `
          create table a (
            one integer not null,
            two integer not null,
            primary key ("one", "two")
          );
          create table b (
            one integer not null,
            two integer not null,
            foreign key ("one", "two") references a ("one", "two")
          );
          insert into a ("one", "two") values (1, 2);
          insert into b ("one", "two") values (1, 2);
        `,
      down: `
        drop table if exists a cascade;
        drop table if exists b cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model a {
          one Int
          two Int

          @@id([one, two])
        }

        /// The underlying table does not contain a unique identifier and can therefore currently not be handled.
        // model b {
          // a a @map(["one", "two"])
        // }
      `,
      do: async client => {
        return client.a.findOne({ where: { variables_value_email_key: { value: 'c', email: 'd' } } })
      },
      expect: {
        // TODO
      },
    },
    {
      todo: true,
      up: `
        create table crazy (
          c1 bigint,
          c2 int8,
          c3 bigserial,
          c4 serial8,
          c5 bit,
          c6 bit(1),
          c7 bit(10),
          c8 bit varying,
          c9 bit varying(1),
          c10 bit varying(10),
          c11 varbit,
          c12 varbit(1),
          c13 varbit(10),
          c14 boolean,
          c15 bool,
          c16 box,
          c17 bytea,
          c18 character,
          c19 character(1),
          c20 character(10),
          c21 char,
          c22 char(1),
          c23 char(10),
          c24 character varying,
          c25 character varying(1),
          c26 character varying(110),
          c27 varchar,
          c28 varchar(1),
          c29 varchar(110),
          c30 cidr,
          c31 circle,
          c32 date,
          c33 double precision,
          c34 float8,
          c35 inet,
          c36 integer,
          c37 int,
          c38 int4,
          c39 interval,
          c40 interval year,
          c41 interval day to hour,
          c42 interval day to second,
          c43 interval day to second(0),
          c44 interval day to second(6),
          c45 interval(0),
          c46 interval(6),
          c47 json,
          c48 jsonb,
          c49 line,
          c50 lseg,
          c51 macaddr,
          c52 money,
          c53 numeric(7,5),
          c54 numeric(10,5),
          c55 decimal,
          c56 decimal(7,5),
          c57 decimal(10,5),
          c63 path,
          c64 pg_lsn,
          c65 point,
          c66 polygon,
          c67 real,
          c68 float4,
          c69 smallint,
          c70 int2,
          c71 smallserial,
          c72 serial2,
          c73 serial,
          c74 serial4,
          c75 text,
          c76 time,
          c77 time(10),
          c78 time(1),
          c79 time without time zone,
          c80 time (10) without time zone,
          c81 time (1) without time zone,
          c82 time with time zone,
          c83 time (10) with time zone,
          c84 time (1) with time zone,
          c85 timestamp without time zone,
          c86 timestamp (10) without time zone,
          c87 timestamp (1) without time zone,
          c88 timestamp with time zone,
          c89 timestamp (10) with time zone,
          c90 timestamp (1) with time zone,
          c91 tsquery,
          c92 tsvector,
          c93 txid_snapshot,
          c94 uuid,
          c95 xml,
          c96 bigint[],
          c97 int8[],
          c100 bit[],
          c101 bit(1)[],
          c102 bit(10)[],
          c103 bit varying[],
          c104 bit varying(1)[],
          c105 bit varying(10)[],
          c106 varbit[],
          c107 varbit(1)[],
          c108 varbit(10)[],
          c109 boolean[],
          c110 bool[],
          c111 box[],
          c112 bytea[],
          c113 character[],
          c114 character(1)[],
          c115 character(10)[],
          c116 char[],
          c117 char(1)[],
          c118 char(10)[],
          c119 character varying[],
          c120 character varying(1)[],
          c121 character varying(110)[],
          c122 varchar[],
          c123 varchar(1)[],
          c124 varchar(110)[],
          c125 cidr[],
          c126 circle[],
          c127 date[],
          c128 double precision[],
          c129 float8[],
          c130 inet[],
          c131 integer[],
          c132 int[],
          c133 int4[],
          c134 interval[],
          c135 interval year[],
          c136 interval day to hour[],
          c137 interval day to second[],
          c138 interval day to second(0)[],
          c139 interval day to second(6)[],
          c140 interval(0)[],
          c141 interval(6)[],
          c142 json[],
          c143 jsonb[],
          c144 line[],
          c145 lseg[],
          c146 macaddr[],
          c147 money[],
          c148 numeric(7,5)[],
          c149 numeric(10,5)[],
          c150 decimal[],
          c151 decimal(7,5)[],
          c152 decimal(10,5)[],
          c158 path[],
          c159 pg_lsn[],
          c160 point[],
          c161 polygon[],
          c162 real[],
          c163 float4[],
          c164 smallint[],
          c165 int2[],
          c170 text[],
          c171 time[],
          c172 time(10)[],
          c173 time(1)[],
          c174 time without time zone[],
          c175 time (10) without time zone[],
          c176 time (1) without time zone[],
          c177 time with time zone[],
          c178 time (10) with time zone[],
          c179 time (1) with time zone[],
          c180 timestamp without time zone[],
          c181 timestamp (10) without time zone[],
          c182 timestamp (1) without time zone[],
          c183 timestamp with time zone[],
          c184 timestamp (10) with time zone[],
          c185 timestamp (1) with time zone[],
          c186 tsquery[],
          c187 tsvector[],
          c188 txid_snapshot[],
          c189 uuid[],
          c190 xml[]
        );
      `,
      down: `
        drop table if exists crazy cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model crazy {
          c1   Int?
          c10  String?
          c100 String[]
          c101 String[]
          c102 String[]
          c103 String[]
          c104 String[]
          c105 String[]
          c106 String[]
          c107 String[]
          c108 String[]
          c109 Boolean[]
          c11  String?
          c110 Boolean[]
          c111 String[]
          c112 String[]
          c113 String[]
          c114 String[]
          c115 String[]
          c116 String[]
          c117 String[]
          c118 String[]
          c119 String[]
          c12  String?
          c120 String[]
          c121 String[]
          c122 String[]
          c123 String[]
          c124 String[]
          c125 String[]
          c126 String[]
          c127 DateTime[]
          c128 Float[]
          c129 Float[]
          c13  String?
          c130 String[]
          c131 Int[]
          c132 Int[]
          c133 Int[]
          c134 DateTime[]
          c135 DateTime[]
          c136 DateTime[]
          c137 DateTime[]
          c138 DateTime[]
          c139 DateTime[]
          c14  Boolean?
          c140 DateTime[]
          c141 DateTime[]
          c142 String[]
          c143 String[]
          c144 String[]
          c145 String[]
          c146 String[]
          c147 String[]
          c148 Float[]
          c149 Float[]
          c15  Boolean?
          c150 Float[]
          c151 Float[]
          c152 Float[]
          c158 String[]
          c159 String[]
          c16  String?
          c160 String[]
          c161 String[]
          c162 Float[]
          c163 Float[]
          c164 Int[]
          c165 Int[]
          c17  String?
          c170 String[]
          c171 DateTime[]
          c172 DateTime[]
          c173 DateTime[]
          c174 DateTime[]
          c175 DateTime[]
          c176 DateTime[]
          c177 DateTime[]
          c178 DateTime[]
          c179 DateTime[]
          c18  String?
          c180 DateTime[]
          c181 DateTime[]
          c182 DateTime[]
          c183 DateTime[]
          c184 DateTime[]
          c185 DateTime[]
          c186 String[]
          c187 String[]
          c188 String[]
          c189 String[]
          c19  String?
          c190 String[]
          c2   Int?
          c20  String?
          c21  String?
          c22  String?
          c23  String?
          c24  String?
          c25  String?
          c26  String?
          c27  String?
          c28  String?
          c29  String?
          c3   Int
          c30  String?
          c31  String?
          c32  DateTime?
          c33  Float?
          c34  Float?
          c35  String?
          c36  Int?
          c37  Int?
          c38  Int?
          c39  DateTime?
          c4   Int
          c40  DateTime?
          c41  DateTime?
          c42  DateTime?
          c43  DateTime?
          c44  DateTime?
          c45  DateTime?
          c46  DateTime?
          c47  String?
          c48  String?
          c49  String?
          c5   String?
          c50  String?
          c51  String?
          c52  String?
          c53  Float?
          c54  Float?
          c55  Float?
          c56  Float?
          c57  Float?
          c6   String?
          c63  String?
          c64  String?
          c65  String?
          c66  String?
          c67  Float?
          c68  Float?
          c69  Int?
          c7   String?
          c70  Int?
          c71  Int
          c72  Int
          c73  Int
          c74  Int
          c75  String?
          c76  DateTime?
          c77  DateTime?
          c78  DateTime?
          c79  DateTime?
          c8   String?
          c80  DateTime?
          c81  DateTime?
          c82  DateTime?
          c83  DateTime?
          c84  DateTime?
          c85  DateTime?
          c86  DateTime?
          c87  DateTime?
          c88  DateTime?
          c89  DateTime?
          c9   String?
          c90  DateTime?
          c91  String?
          c92  String?
          c93  String?
          c94  String?
          c95  String?
          c96  Int[]
          c97  Int[]
        }
      `,
      do: async client => {
        return client.crazy.findOne({ where: { variables_value_email_key: { value: 'c', email: 'd' } } })
      },
      expect: {
        // TODO
      },
    },
    {
      up: `
        create table teams (
          id serial primary key not null,
          name text
        );
        insert into teams (name) values ('a');
        insert into teams (name) values (NULL);
        insert into teams (name) values (NULL);
      `,
      down: `
        drop table if exists teams cascade;
      `,
      schema: `
        generator client {
          provider = "prisma-client-js"
          output   = "${tmp}"
        }

        datasource pg {
          provider = "postgresql"
          url      = "${connectionString}"
        }

        model teams {
          id   Int     @id
          name String?
        }
      `,
      do: async client => {
        await client.teams.updateMany({
          data: { name: 'b' },
          where: { name: null },
        })
        return client.teams.findMany()
      },
      expect: [
        {
          id: 1,
          name: 'a',
        },
        {
          id: 2,
          name: 'b',
        },
        {
          id: 3,
          name: 'b',
        },
      ],
    },
  ]
}

export function maskSchema(schema: string): string {
  const urlRegex = /url\s*=\s*.+/
  const outputRegex = /output\s*=\s*.+/
  return schema
    .split('\n')
    .map(line => {
      const urlMatch = urlRegex.exec(line)
      if (urlMatch) {
        return `${line.slice(0, urlMatch.index)}url = "***"`
      }
      const outputMatch = outputRegex.exec(line)
      if (outputMatch) {
        return `${line.slice(0, outputMatch.index)}output = "***"`
      }
      return line
    })
    .join('\n')
}
