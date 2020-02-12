import { getGenerator, IntrospectionEngine, getDMMF, dmmfToDml } from '@prisma/sdk'
import stripIndent from 'strip-indent'
import chalk from 'chalk'
import { join, dirname } from 'path'
import mkdir from 'make-dir'
import { Client } from 'pg'
import assert from 'assert'
import pkgup from 'pkg-up'
import { promisify } from 'util'
import rimraf from 'rimraf'
import fs from 'fs'
import path from 'path'

const connectionString = process.env.TEST_POSTGRES_URI || 'postgres://localhost:5432/prisma-dev'
process.env.SKIP_GENERATE = 'true'

const db = new Client({
  connectionString,
})

const pkg = pkgup.sync() || __dirname
const tmp = join(dirname(pkg), 'tmp')
const engine = new IntrospectionEngine()

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

tests().map((t: Test) => {
  const name = prettyName(t.do)

  if (t.todo) {
    it.skip(name)
    return
  }

  it(name, async () => {
    try {
      await runTest(t)
    } catch (err) {
      throw err
    } finally {
      await db.query(t.down)
    }
  }).timeout(15000)
})

async function runTest(t: Test) {
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
  let actual = stripIndent(datamodel).trim()
  let expect = stripIndent(test.schema).trim()
  if (actual !== expect) {
    console.log(chalk.bold('Expect'))
    console.log()
    console.log(expect)
    console.log()
    console.log(chalk.bold('Actual'))
    console.log()
    console.log(actual)
    assert.equal(actual, expect)
  }

  const generator = await getGenerator({
    schemaPath,
    printDownloadProgress: false,
    baseDir: tmp,
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
          email   String  @unique
          id      Int     @id
          postses posts[]
        }
      `,
      do: async client => {
        return client.users.findOne({ where: { id: 1 }, include: { postses: true } })
      },
      expect: {
        email: 'ada@prisma.io',
        id: 1,
        postses: [
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
        return client.teams.create({ data: { name: 'c', id: 1 } })
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
        return client.teams.create({ data: { id: 1 } })
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
      todo: false,
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
        --drop table if exists users cascade;
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
          email   String  @unique
          id      Int     @id
          postses posts[]
        }
      `,
      do: async client => {
        return client.users.findOne({ where: { email: 'ada@prisma.io' } }).postses()
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
  ]
}

function prettyName(fn: any): string {
  const fnstr = fn.toString()
  const from = fnstr.indexOf('{')
  const to = fnstr.lastIndexOf('}')
  const sig = fnstr.slice(from + 1, to)
  return sig
    .replace(/\s{2,}/g, ' ')
    .replace('client.', '')
    .replace('return', '')
    .replace(/\n/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\r/g, ' ')
    .replace(';', '')
    .trim()
}
