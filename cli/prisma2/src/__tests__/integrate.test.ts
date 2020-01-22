import { getGenerator, IntrospectionEngine, getDMMF, dmmfToDml } from '@prisma/sdk'
import { join, dirname } from 'path'
import mkdir from 'make-dir'
import { Client } from 'pg'
import assert from 'assert'
import pkgup from 'pkg-up'
import { promisify } from 'util'
import rimraf from 'rimraf'
import fs from 'fs'
import path from 'path'
const del = promisify(rimraf)

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
  await del(tmp)
  await mkdir(tmp)
})

after(async () => {
  await db.end()
  engine.stop()
})

tests().map(t => {
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
      await db.query(t.after)
    }
  }).timeout(15000)
})

async function runTest(t) {
  await db.query(t.after)
  await db.query(t.before)
  const introspectionSchema = await engine.introspect(connectionString)
  await generate(introspectionSchema)
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
    await db.query(t.after)
    assert.deepEqual(result, t.expect)
  } catch (err) {
    throw err
  } finally {
    await prisma.disconnect()
  }
}

async function generate(introspectionSchema: string) {
  const dmmf = await getDMMF({ datamodel: introspectionSchema })

  const datamodel = await dmmfToDml({
    dmmf: dmmf.datamodel,
    config: {
      datasources: [
        {
          name: 'pg',
          connectorType: 'postgresql',
          url: {
            value: `${connectionString}?schema=public`,
            fromEnvVar: null,
          },
          config: {},
        },
      ],
      generators: [
        {
          binaryTargets: [],
          config: {},
          name: 'client',
          output: tmp,
          provider: 'prisma-client-js',
        },
      ],
    },
  })

  const schemaPath = path.join(tmp, 'schema.prisma')
  fs.writeFileSync(schemaPath, datamodel)

  const generator = await getGenerator({
    schemaPath,
    printDownloadProgress: false,
    baseDir: tmp,
  })

  await generator.generate()

  generator.stop()
}

function tests() {
  return [
    {
      before: `
        create table if not exists teams (
          id int primary key not null,
          name text not null unique
        );
        insert into teams (id, name) values (1, 'a');
        insert into teams (id, name) values (2, 'b');
      `,
      after: `
        drop table if exists teams cascade;
      `,
      do: async client => {
        return client.team.findOne({ where: { id: 2 } })
      },
      expect: {
        id: 2,
        name: 'b',
      },
    },
    {
      before: `
        create table if not exists teams (
          id int primary key not null,
          name text not null unique,
          email text not null unique
        );
        insert into teams (id, name, email) values (1, 'a', 'a@a');
        insert into teams (id, name, email) values (2, 'b', 'b@b');
      `,
      after: `
        drop table if exists teams cascade;
      `,
      do: async client => {
        return client.team.findOne({ where: { id: 2 }, select: { name: true } })
      },
      expect: {
        name: 'b',
      },
    },
    {
      todo: false,
      before: `
        create table if not exists users (
          id serial primary key not null,
          email text not null unique
        );
        create table if not exists posts (
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
      after: `
        drop table if exists posts cascade;
        drop table if exists users cascade;
      `,
      do: async client => {
        return client.user.findOne({ where: { id: 1 }, include: { postses: true } })
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
      before: `
        create table if not exists teams (
          id serial primary key not null,
          name text not null unique
        );
      `,
      after: `
        drop table if exists teams cascade;
      `,
      do: async client => {
        return client.team.create({ data: { name: 'c', id: 1 } })
      },
      expect: {
        id: 1,
        name: 'c',
      },
    },
    {
      before: `
        create table if not exists teams (
          id serial primary key not null,
          name text not null unique
        );
        insert into teams ("name") values ('c');
      `,
      after: `
        drop table if exists teams cascade;
      `,
      do: async client => {
        return client.team.update({
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
      before: `
        create table if not exists users (
          id serial primary key not null,
          email text not null unique
        );
        insert into users ("email") values ('ada@prisma.io');
      `,
      after: `
        drop table if exists users cascade;
      `,
      do: async client => {
        return client.user.findOne({ where: { email: 'ada@prisma.io' } })
      },
      expect: {
        id: 1,
        email: 'ada@prisma.io',
      },
    },
    {
      before: `
        create table if not exists users (
          id serial primary key not null,
          email text not null unique
        );
        insert into users ("email") values ('ada@prisma.io');
      `,
      after: `
        drop table if exists users cascade;
      `,
      do: async client => {
        return client.user({ where: { email: 'ada@prisma.io' } })
      },
      expect: [
        {
          id: 1,
          email: 'ada@prisma.io',
        },
      ],
    },

    {
      before: `
        create table if not exists users (
          id serial primary key not null,
          email text not null unique
        );
        insert into users ("email") values ('ada@prisma.io');
        insert into users ("email") values ('ema@prisma.io');
      `,
      after: `
        drop table if exists users cascade;
      `,
      do: async client => {
        return client.user()
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
      before: `
        create table if not exists users (
          id serial primary key not null,
          email text not null unique
        );
        create table if not exists posts (
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
      after: `
        drop table if exists posts cascade;
        drop table if exists users cascade;
      `,
      do: async client => {
        return client.user.findOne({ where: { email: 'ada@prisma.io' } }).postses()
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
      before: `
        create table if not exists posts (
          id serial primary key not null,
          title text not null,
          published boolean not null default false
        );
        insert into posts ("title", "published") values ('A', true);
        insert into posts ("title", "published") values ('B', false);
        insert into posts ("title", "published") values ('C', true);
      `,
      after: `
        drop table if exists posts cascade;
      `,
      do: async client => {
        return client.post.findMany({
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
      before: `
        create table if not exists posts (
          id serial primary key not null,
          title text not null,
          published boolean not null default false
        );
        insert into posts ("title", "published") values ('A', true);
        insert into posts ("title", "published") values ('B', false);
        insert into posts ("title", "published") values ('C', true);
      `,
      after: `
        drop table if exists posts cascade;
      `,
      do: async client => {
        return client.post.findMany({
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

function prettyName(fn) {
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
