import { PostgresConnector } from 'prisma-db-introspection'
import { generateClient } from '@prisma/photon'
import { isdlToDatamodel2 } from '@prisma/lift'
import { ISDL } from 'prisma-datamodel'
import { join, dirname } from 'path'
import { writeFile } from 'mz/fs'
import mkdir from 'make-dir'
import { Client } from 'pg'
import assert from 'assert'
import pkgup from 'pkg-up'
import exec from 'execa'
import del from 'del'

const db = new Client({
  connectionString: 'postgres://localhost:5432/prisma-dev',
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

  it(
    name,
    // async () => {
    //   await db.query(t.after)
    //   await db.query(t.before)
    //   const bin = join(process.cwd(), 'build', 'index.js')

    //   // $ prisma introspect
    //   const { stdout } = await exec(
    //     bin,
    //     [
    //       'introspect',
    //       '--pg-host',
    //       'localhost',
    //       '--pg-db',
    //       'prisma-dev',
    //       '--pg-user',
    //       'm',
    //       '--pg-schema',
    //       'public',
    //       '--pg-password',
    //       '',
    //       '--sdl',
    //     ],
    //     { cwd: tmp },
    //   )

    //   // write a prisma file
    //   await writeFile(join(tmp, 'datamodel.prisma'), stdout)

    //   // $ prisma generate
    //   await exec(bin, ['generate'], { cwd: tmp })

    //   const { Photon } = await import(join(tmp, 'node_modules', '@generated', 'photon', 'index.js'))
    //   const client = new Photon()
    //   try {
    //     const result = await t.do(client)
    //     await db.query(t.after)
    //     assert.deepEqual(result, t.expect)
    //   } catch (err) {
    //     throw err
    //   } finally {
    //     await client.disconnect()
    //   }
    // },
    async () => {
      try {
        await runTest(t)
      } catch (err) {
        throw err
      } finally {
        await db.query(t.after)
      }
    },
  )
})

async function runTest(t) {
  await db.query(t.after)
  await db.query(t.before)
  const isdl = await inspect(db, 'public')
  // console.log(isdl)

  // $ prisma introspect
  // const bin = join(process.cwd(), 'build', 'index.js')
  // const { stdout: datamodel } = await exec(
  //   bin,
  //   [
  //     'introspect',
  //     '--pg-host',
  //     'localhost',
  //     '--pg-db',
  //     'prisma-dev',
  //     '--pg-user',
  //     'm',
  //     '--pg-schema',
  //     'public',
  //     '--pg-password',
  //     '',
  //     '--sdl',
  //   ],
  //   { cwd: tmp },
  // )
  // console.log(datamodel)

  await generate(isdl)
  const photonPath = join(tmp, 'index.js')
  // clear the require cache
  delete require.cache[photonPath]
  const { default: Photon } = await import(photonPath)
  const client = new Photon()
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

// async function migrate() {}

async function generate(isdl: ISDL) {
  const datamodel = await isdlToDatamodel2(isdl, [
    {
      name: 'pg',
      connectorType: 'postgres',
      url: `postgres://m@localhost:5432/prisma-dev?schema=public`,
      config: {},
    },
  ])
  await generateClient({
    datamodel: datamodel,
    cwd: tmp,
    outputDir: tmp,
    transpile: true,
    runtimePath: '../runtime',
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
      todo: true,
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
      todo: true,
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
        name: 'b',
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
