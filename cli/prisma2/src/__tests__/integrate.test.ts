import { PostgresConnector } from 'prisma-db-introspection'
import { generateClient, isdlToDatamodel2 } from '@prisma/photon'
import { ISDL } from 'prisma-datamodel'
import { join, dirname } from 'path'
import mkdir from 'make-dir'
import { Client } from 'pg'
import assert from 'assert'
import pkgup from 'pkg-up'
import del from 'del'
import fs from 'fs'

const host = process.env.TEST_POSTGRES_URI || 'postgres://localhost:5432/prisma-dev'

const db = new Client({
  connectionString: host,
})

const pkg = pkgup.sync() || __dirname
const tmp = join(dirname(pkg), 'tmp')

before(done => {
  db.connect(err => done(err))
})

beforeEach(async () => {
  await del(tmp)
  await mkdir(tmp)
})

after(async () => {
  await db.end()
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
  })
})

async function runTest(t) {
  await db.query(t.after)
  await db.query(t.before)
  const isdl = await inspect(db, 'public')

  await generate(isdl)
  const photonPath = join(tmp, 'index.js')
  const photonDeclarationPath = join(tmp, 'index.d.ts')

  assert(fs.existsSync(photonPath))
  assert(fs.existsSync(photonDeclarationPath))

  // clear the require cache
  delete require.cache[photonPath]
  const { Photon } = await import(photonPath)
  const client = new Photon()
  await client.connect()
  try {
    const result = await t.do(client)
    await db.query(t.after)
    assert.deepEqual(result, t.expect)
  } catch (err) {
    throw err
  } finally {
    await client.disconnect()
  }
}

async function inspect(client: Client, schema: string): Promise<ISDL> {
  const connector = new PostgresConnector(client)
  const result = await connector.introspect(schema)
  return result.getNormalizedDatamodel()
}

async function generate(isdl: ISDL) {
  const datamodel = await isdlToDatamodel2(isdl, [
    {
      name: 'pg',
      connectorType: 'postgresql',
      url: {
        value: `${host}?schema=public`,
        fromEnvVar: null,
      },
      config: {},
    },
  ])
  await generateClient({
    datamodel: datamodel,
    cwd: tmp,
    outputDir: tmp,
    transpile: true,
  })
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
        return client.teams.findOne({ where: { id: 2 } })
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
        return client.teams.findOne({ where: { id: 2 }, select: { name: true } })
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
        return client.teams.create({ data: { name: 'c' } })
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
        return client.users.findOne({ where: { email: 'ada@prisma.io' } })
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
        return client.users({ where: { email: 'ada@prisma.io' } })
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
        return client.users()
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
