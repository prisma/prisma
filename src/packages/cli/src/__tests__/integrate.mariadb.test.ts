import { getGenerator, IntrospectionEngine } from '@prisma/sdk'
import { join, dirname } from 'path'
import mkdir from 'make-dir'
import assert from 'assert'
import pkgup from 'pkg-up'
import rimraf from 'rimraf'
import fs from 'fs'
import path from 'path'
import snapshot from 'snap-shot-it'
import mariadb from 'mariadb'
import { getLatestAlphaTag } from '@prisma/fetch-engine'
import { uriToCredentials } from '@prisma/sdk'

let connectionString =
  process.env.TEST_MARIADB_URI || 'mysql://prisma:prisma@localhost:4306/tests'
const credentials = uriToCredentials(connectionString)
process.env.SKIP_GENERATE = 'true'

const pkg = pkgup.sync() || __dirname
const tmp = join(dirname(pkg), 'tmp-mysql')
const engine = new IntrospectionEngine()
const latestAlphaPromise = getLatestAlphaTag()

let db: mariadb.Connection
before(async () => {
  db = await mariadb.createConnection({
    host: credentials.host,
    port: credentials.port,
    database: credentials.database,
    user: credentials.user,
    password: credentials.password,
    multipleStatements: true,
  })
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
  const name = t.name

  // if (!t.run) {
  //   it.skip(name)
  //   return
  // }

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

datasource mysql {
  provider = "mysql"
  url = "${connectionString}"
}`
  const introspectionResult = await engine.introspect(schema)
  const introspectionSchema = introspectionResult.datamodel

  snapshot(`${name}_datamodel`, maskSchema(introspectionSchema))
  snapshot(`${name}_warnings`, introspectionResult.warnings)

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
  todo?: boolean
  run?: boolean
  name: string
  up: string
  down: string
  do: (client: any) => Promise<any>
  expect: any
}

function tests(): Test[] {
  return [
    {
      name: 'findOne where PK',
      up: `
        create table teams (
          id int primary key not null,
          name varchar(50) not null unique
        );
        insert into teams (id, name) values (1, 'a');
        insert into teams (id, name) values (2, 'b');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      do: async (client) => {
        return client.teams.findOne({ where: { id: 2 } })
      },
      expect: {
        id: 2,
        name: 'b',
      },
    },
    {
      name: 'findOne where PK with select',
      up: `
        create table teams (
          id int primary key not null,
          name varchar(50) not null unique,
          email varchar(50) not null unique
        );
        insert into teams (id, name, email) values (1, 'a', 'a@a');
        insert into teams (id, name, email) values (2, 'b', 'b@b');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      do: async (client) => {
        return client.teams.findOne({
          where: { id: 2 },
          select: { name: true },
        })
      },
      expect: {
        name: 'b',
      },
    },
    {
      name: 'findOne where PK with include',
      up: `
        create table users (
          id serial primary key not null,
          email varchar(50) not null unique
        );
        create table posts (
          id serial primary key not null,
          user_id bigint unsigned not null,
          title varchar(50) not null
        );
        ALTER TABLE posts ADD FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE;
        insert into users (email) values ('ada@prisma.io');
        insert into users (email) values ('ema@prisma.io');
        insert into posts (user_id, title) values (1, 'A');
        insert into posts (user_id, title) values (1, 'B');
        insert into posts (user_id, title) values (2, 'C');
      `,
      down: `
        drop table if exists posts cascade;
        drop table if exists users cascade;
      `,
      do: async (client) => {
        return client.users.findOne({
          where: { id: 1 },
          include: { posts: true },
        })
      },
      expect: {
        email: 'ada@prisma.io',
        id: 1,
        posts: [
          {
            id: 1,
            title: 'A',
            user_id: 1,
          },
          {
            id: 2,
            title: 'B',
            user_id: 1,
          },
        ],
      },
    },
    {
      name: 'create with data',
      up: `
        create table teams (
          id serial primary key not null,
          name varchar(50) not null unique
        );
      `,
      down: `
        drop table if exists teams cascade;
      `,
      do: async (client) => {
        return client.teams.create({ data: { name: 'c' } })
      },
      expect: {
        id: 1,
        name: 'c',
      },
    },
    {
      name: 'create with empty data and SQL default',
      up: `
        create table teams (
          id serial primary key not null,
          name varchar(50) not null default 'alice'
        );
      `,
      down: `
        drop table if exists teams cascade;
      `,
      do: async (client) => {
        return client.teams.create({ data: {} })
      },
      expect: {
        id: 1,
        name: 'alice',
      },
    },
    {
      todo: true,
      name: 'create with empty data and serial',
      up: `
        create table teams (
          id serial primary key not null
        );
      `,
      down: `
        drop table if exists teams cascade;
      `,
      do: async (client) => {
        return client.teams.create({ data: {} })
      },
      expect: {
        id: 1,
        name: 'alice',
      },
    },
    {
      name: 'update where with numeric data',
      up: `
        create table teams (
          id serial primary key not null,
          name varchar(50) not null unique
        );
        insert into teams (name) values ('c');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      do: async (client) => {
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
      name: 'update where with boolean data',
      up: `
        create table teams (
          id serial primary key not null,
          name varchar(50) not null unique,
          active boolean not null default true
        );
        insert into teams (name) values ('c');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      do: async (client) => {
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
      name: 'update where with boolean data and select',
      up: `
        create table teams (
          id serial primary key not null,
          name varchar(50) not null unique,
          active boolean not null default true
        );
        insert into teams (name) values ('c');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      do: async (client) => {
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
      name: 'update where with string data',
      up: `
        create table teams (
          id serial primary key not null,
          name varchar(50) not null unique
        );
        insert into teams (name) values ('c');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      do: async (client) => {
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
      name: 'updateMany where with string data - check returned count',
      up: `
        create table teams (
          id serial primary key not null,
          name varchar(50) not null
        );
        insert into teams (name) values ('c');
        insert into teams (name) values ('c');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      do: async (client) => {
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
      name: 'updateMany where with string data - check findMany',
      up: `
        create table teams (
          id serial primary key not null,
          name varchar(50) not null
        );
        insert into teams (name) values ('c');
        insert into teams (name) values ('c');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      do: async (client) => {
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
      name: 'findOne where unique',
      up: `
        create table users (
          id serial primary key not null,
          email varchar(50) not null unique
        );
        insert into users (email) values ('ada@prisma.io');
      `,
      down: `
        drop table if exists users cascade;
      `,
      do: async (client) => {
        return client.users.findOne({ where: { email: 'ada@prisma.io' } })
      },
      expect: {
        id: 1,
        email: 'ada@prisma.io',
      },
    },
    {
      name: 'findOne where composite unique',
      up: `
        create table users (
          id serial primary key not null,
          email varchar(50) not null,
          name varchar(50) not null,
          unique key users_email_name_key(email, name)
        );
        insert into users (email, name) values ('ada@prisma.io', 'Ada');
      `,
      down: `
        drop table if exists users cascade;
      `,
      do: async (client) => {
        return client.users.findOne({
          where: {
            users_email_name_key: { email: 'ada@prisma.io', name: 'Ada' },
          },
        })
      },
      expect: {
        id: 1,
        email: 'ada@prisma.io',
        name: 'Ada',
      },
    },
    {
      name: 'update where composite unique',
      up: `
        create table users (
          id serial primary key not null,
          email varchar(50) not null,
          name varchar(50) not null,
          unique key users_email_name_key(email, name)
        );
        insert into users (email, name) values ('ada@prisma.io', 'Ada');
      `,
      down: `
        drop table if exists users cascade;
      `,
      do: async (client) => {
        return client.users.update({
          where: {
            users_email_name_key: { email: 'ada@prisma.io', name: 'Ada' },
          },
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
      name: 'delete where composite unique',
      up: `
        create table users (
          id serial primary key not null,
          email varchar(50) not null,
          name varchar(50) not null,
          unique key users_email_name_key(email, name)
        );
        insert into users (email, name) values ('ada@prisma.io', 'Ada');
      `,
      down: `
        drop table if exists users cascade;
      `,
      do: async (client) => {
        return client.users.delete({
          where: {
            users_email_name_key: { email: 'ada@prisma.io', name: 'Ada' },
          },
        })
      },
      expect: {
        id: 1,
        email: 'ada@prisma.io',
        name: 'Ada',
      },
    },
    {
      name: 'findMany - email text',
      up: `
        create table users (
          id serial primary key not null,
          email text
        );
        insert into users (email) values ('ada@prisma.io');
        insert into users (email) values (null);
      `,
      down: `
        drop table if exists users cascade;
      `,
      do: async (client) => {
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
      name: 'findMany where unique',
      up: `
        create table users (
          id serial primary key not null,
          email varchar(50) not null unique
        );
        insert into users (email) values ('ada@prisma.io');
      `,
      down: `
        drop table if exists users cascade;
      `,
      do: async (client) => {
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
      name: 'findMany - email varchar(50) not null unique',
      up: `
        create table users (
          id serial primary key not null,
          email varchar(50) not null unique
        );
        insert into users (email) values ('ada@prisma.io');
        insert into users (email) values ('ema@prisma.io');
      `,
      down: `
        drop table if exists users cascade;
      `,
      do: async (client) => {
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
      name: 'findOne where unique with foreign key and unpack',
      up: `
        create table users (
          id serial primary key not null,
          email varchar(50) not null unique
        );
        create table posts (
          id serial primary key not null,
          user_id bigint unsigned not null,
          title varchar(50) not null
        );
        ALTER TABLE posts ADD FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE;
        insert into users (email) values ('ada@prisma.io');
        insert into users (email) values ('ema@prisma.io');
        insert into posts (user_id, title) values (1, 'A');
        insert into posts (user_id, title) values (1, 'B');
        insert into posts (user_id, title) values (2, 'C');
      `,
      down: `
        drop table if exists posts cascade;
        drop table if exists users cascade;
      `,
      do: async (client) => {
        return client.users
          .findOne({ where: { email: 'ada@prisma.io' } })
          .posts()
      },
      expect: [
        {
          id: 1,
          title: 'A',
          user_id: 1,
        },
        {
          id: 2,
          title: 'B',
          user_id: 1,
        },
      ],
    },
    {
      name: 'findMany where contains and boolean',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          published boolean not null default false
        );
        insert into posts (title, published) values ('A', true);
        insert into posts (title, published) values ('B', false);
        insert into posts (title, published) values ('C', true);
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
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
      name: 'findMany where OR[contains, contains] ',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          published boolean not null default false
        );
        insert into posts (title, published) values ('A', true);
        insert into posts (title, published) values ('B', false);
        insert into posts (title, published) values ('C', true);
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
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
      name: 'upsert (update)',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          published boolean not null default false
        );
        insert into posts (title, published) values ('A', true);
        insert into posts (title, published) values ('B', false);
        insert into posts (title, published) values ('C', true);
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
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
      name: 'upsert (create)',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          published boolean not null default false
        );
        insert into posts (title, published) values ('A', true);
        insert into posts (title, published) values ('B', false);
        insert into posts (title, published) values ('C', true);
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
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
      name: 'findMany orderBy asc',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          published boolean not null default false
        );
        insert into posts (title, published) values ('A', true);
        insert into posts (title, published) values ('B', false);
        insert into posts (title, published) values ('C', true);
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
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
      name: 'findMany orderBy desc',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          published boolean not null default false
        );
        insert into posts (title, published) values ('A', true);
        insert into posts (title, published) values ('B', false);
        insert into posts (title, published) values ('C', true);
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
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
      name: 'findMany - default enum',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          published enum ('DRAFT','PUBLISHED') not null default 'DRAFT'
        );
        insert into posts (title) values ('A');
        insert into posts (title) values ('B');
        insert into posts (title) values ('C');
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
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
      name: 'create with data - not null enum',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          published enum ('DRAFT','PUBLISHED') not null default 'DRAFT'
        );
        insert into posts (title) values ('A');
        insert into posts (title) values ('B');
        insert into posts (title) values ('C');
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
        return client.posts.create({ data: { title: 'D' } })
      },
      expect: {},
    },
    {
      name: 'update with data - not null enum',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          published enum ('DRAFT','PUBLISHED') not null default 'DRAFT'
        );
        insert into posts (title) values ('A');
        insert into posts (title) values ('B');
        insert into posts (title) values ('C');
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
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
      name: 'updateMany with data - not null enum - check count',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          published enum ('DRAFT','PUBLISHED') not null default 'DRAFT'
        );
        insert into posts (title) values ('A');
        insert into posts (title) values ('B');
        insert into posts (title) values ('C');
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
        return client.posts.updateMany({
          data: { published: 'PUBLISHED' },
        })
      },
      expect: {
        count: 3,
      },
    },
    {
      name: 'update with data - not null enum - check findMany',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          published enum ('DRAFT','PUBLISHED') not null default 'DRAFT'
        );
        insert into posts (title) values ('A');
        insert into posts (title) values ('B');
        insert into posts (title) values ('C');
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
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
      name: 'deleteMany where enum - check count',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          published enum ('DRAFT','PUBLISHED') not null default 'DRAFT'
        );
        insert into posts (title) values ('A');
        insert into posts (title) values ('B');
        insert into posts (title, published) values ('C', 'PUBLISHED');
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
        return await client.posts.deleteMany({
          where: { published: 'DRAFT' },
        })
      },
      expect: {
        count: 2,
      },
    },
    {
      name: 'deleteMany where enum - check findMany',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          published enum ('DRAFT','PUBLISHED') not null default 'DRAFT'
        );
        insert into posts (title) values ('A');
        insert into posts (title) values ('B');
        insert into posts (title, published) values ('C', 'PUBLISHED');
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
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
      name: 'findMany where contains',
      up: `
        create table crons (
          id serial not null primary key,
          job varchar(50) unique not null,
          frequency text
        );
        insert into crons (job, frequency) values ('j1', '* * * * *');
        insert into crons (job, frequency) values ('j20', '* * * * 1-5');
        insert into crons (job, frequency) values ('j21', '* * * * 1-5');
      `,
      down: `
        drop table if exists crons cascade;
      `,
      do: async (client) => {
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
      name: 'findMany where startsWith',
      up: `
        create table crons (
          id serial not null primary key,
          job varchar(50) unique not null,
          frequency text
        );
        insert into crons (job, frequency) values ('j1', '* * * * *');
        insert into crons (job, frequency) values ('j20', '* * * * 1-5');
        insert into crons (job, frequency) values ('j21', '* * * * 1-5');
      `,
      down: `
        drop table if exists crons cascade;
      `,
      do: async (client) => {
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
      name: 'findMany where endsWith',
      up: `
        create table crons (
          id serial not null primary key,
          job varchar(50) unique not null,
          frequency text
        );
        insert into crons (job, frequency) values ('j1', '* * * * *');
        insert into crons (job, frequency) values ('j20', '* * * * 1-5');
        insert into crons (job, frequency) values ('j21', '* * * * 1-5');
      `,
      down: `
        drop table if exists crons cascade;
      `,
      do: async (client) => {
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
      name: 'findMany where in[string]',
      up: `
        create table crons (
          id serial not null primary key,
          job varchar(50) unique not null,
          frequency text
        );
        insert into crons (job, frequency) values ('j1', '* * * * *');
        insert into crons (job, frequency) values ('j20', '* * * * 1-5');
        insert into crons (job, frequency) values ('j21', '* * * * 1-5');
      `,
      down: `
        drop table if exists crons cascade;
      `,
      do: async (client) => {
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
      name: 'findOne where in[]',
      todo: true,
      up: `
        create table crons (
          id serial not null primary key,
          job varchar(50) unique not null,
          frequency text
        );
        insert into crons (job, frequency) values ('j1', '* * * * *');
        insert into crons (job, frequency) values ('j20', '* * * * 1-5');
        insert into crons (job, frequency) values ('j21', '* * * * 1-5');
      `,
      down: `
        drop table if exists crons cascade;
      `,
      do: async (client) => {
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
      name: 'findMany where datetime lte - check instanceof Date',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        insert into posts (title, created_at) values ('A', '2020-01-14 11:10:19');
        insert into posts (title, created_at) values ('B', '2020-01-14 11:10:19');
        insert into posts (title, created_at) values ('C', '2020-01-14 11:10:19');
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
        const posts = await client.posts.findMany({
          where: { created_at: { lte: new Date() } },
        })
        posts.forEach((post) => {
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
      name: 'findMany where timestamp gte than now',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          created_at timestamp not null default now()
        );
        insert into posts (title, created_at) values ('A', '2020-01-14 11:10:19');
        insert into posts (title, created_at) values ('B', '2020-01-14 11:10:19');
        insert into posts (title, created_at) values ('C', '2020-01-14 11:10:19');
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
        return client.posts.findMany({
          where: { created_at: { gte: new Date() } },
        })
      },
      expect: [],
    },
    {
      name: 'findMany where timestamp gt than now',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          created_at timestamp not null default now()
        );
        insert into posts (title, created_at) values ('A', '2020-01-14 11:10:19');
        insert into posts (title, created_at) values ('B', '2020-01-14 11:10:19');
        insert into posts (title, created_at) values ('C', '2020-01-14 11:10:19');
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
        return client.posts.findMany({
          where: { created_at: { gt: new Date() } },
        })
      },
      expect: [],
    },
    {
      name: 'findMany where timestamp lt than now',
      up: `
        create table posts (
          id serial primary key not null,
          title varchar(50) not null,
          created_at timestamp not null default now()
        );
        insert into posts (title, created_at) values ('A', '2020-01-14 11:10:19');
        insert into posts (title, created_at) values ('B', '2020-01-14 11:10:19');
        insert into posts (title, created_at) values ('C', '2020-01-14 11:10:19');
      `,
      down: `
        drop table if exists posts cascade;
      `,
      do: async (client) => {
        const posts = await client.posts.findMany({
          where: { created_at: { lt: new Date() } },
        })
        posts.forEach((post) => {
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
      name: 'update where integer data',
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
      do: async (client) => {
        return client.teams.update({
          where: { token: 11 },
          data: { token: 10 },
        })
      },
      expect: {
        id: 1,
        token: 10,
      },
    },
    {
      name: 'findMany where datetime exact',
      up: `
        create table events (
          id serial not null primary key,
          time datetime
        );
        insert into events (time) values ('2018-09-04 00:00:00');
      `,
      down: `
        drop table if exists events cascade;
      `,
      do: async (client) => {
        return client.events.findMany({
          where: { time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) },
        })
      },
      expect: [
        {
          id: 1,
          time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)),
        },
      ],
    },
    {
      name: 'findMany where datetime gt',
      up: `
        create table events (
          id serial not null primary key,
          time datetime
        );
        insert into events (time) values ('2018-09-04 00:00:00');
      `,
      down: `
        drop table if exists events cascade;
      `,
      do: async (client) => {
        return client.events.findMany({
          where: { time: { gt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } },
        })
      },
      expect: [],
    },
    {
      name: 'findMany where datetime gte',
      up: `
        create table events (
          id serial not null primary key,
          time datetime
        );
        insert into events (time) values ('2018-09-04 00:00:00');
      `,
      down: `
        drop table if exists events cascade;
      `,
      do: async (client) => {
        return client.events.findMany({
          where: { time: { gte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } },
        })
      },
      expect: [
        {
          id: 1,
          time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)),
        },
      ],
    },
    {
      name: 'findMany where datetime lt',
      up: `
        create table events (
          id serial not null primary key,
          time datetime
        );
        insert into events (time) values ('2018-09-04 00:00:00');
      `,
      down: `
        drop table if exists events cascade;
      `,
      do: async (client) => {
        return client.events.findMany({
          where: { time: { lt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } },
        })
      },
      expect: [],
    },
    {
      name: 'findMany where datetime lte',
      up: `
        create table events (
          id serial not null primary key,
          time datetime
        );
        insert into events (time) values ('2018-09-04 00:00:00');
      `,
      down: `
        drop table if exists events cascade;
      `,
      do: async (client) => {
        return client.events.findMany({
          where: { time: { lte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } },
        })
      },
      expect: [
        {
          id: 1,
          time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)),
        },
      ],
    },
    {
      name: 'findMany where datetime not',
      up: `
        create table events (
          id serial not null primary key,
          time datetime
        );
        insert into events (time) values ('2018-09-04 00:00:00');
      `,
      down: `
        drop table if exists events cascade;
      `,
      do: async (client) => {
        return client.events.findMany({
          where: { time: { not: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } },
        })
      },
      expect: [],
    },
    {
      name: 'findMany where null',
      up: `
        create table events (
          id serial not null primary key,
          time datetime
        );
        insert into events (time) values (NULL);
        insert into events (time) values (NULL);
        insert into events (time) values (NULL);
      `,
      down: `
        drop table if exists events cascade;
      `,
      do: async (client) => {
        return client.events.findMany({ where: { time: null } })
      },
      expect: [
        {
          id: 1,
          time: null,
        },
        {
          id: 2,
          time: null,
        },
        {
          id: 3,
          time: null,
        },
      ],
    },
    {
      name: 'findMany where empty in[]',
      up: `
        create table teams (
          id serial primary key not null,
          token integer unique not null,
          name varchar(50) not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      do: async (client) => {
        return client.teams.findMany({ where: { id: { in: [] } } })
      },
      expect: [],
    },
    {
      name: 'findMany where id empty in[] and token in[]',
      up: `
        create table teams (
          id serial primary key not null,
          token integer unique not null,
          name varchar(50) not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      do: async (client) => {
        return client.teams.findMany({
          where: { id: { in: [] }, token: { in: [11, 22] } },
        })
      },
      expect: [],
    },
    {
      name: 'findMany where in[integer]',
      up: `
        create table teams (
          id serial primary key not null,
          token integer unique not null,
          name varchar(50) not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      do: async (client) => {
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
      name: 'findMany where notIn[]',
      up: `
        create table teams (
          id serial primary key not null,
          token integer unique not null,
          name varchar(50) not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      do: async (client) => {
        return client.teams.findMany({ where: { token: { notIn: [11, 22] } } })
      },
      expect: [],
    },
    {
      name: 'findMany where empty notIn[]',
      up: `
        create table teams (
          id serial primary key not null,
          token integer unique not null,
          name varchar(50) not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
      down: `
        drop table if exists teams cascade;
      `,
      do: async (client) => {
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
      name: 'findMany where null',
      up: `
        create table teams (
          id serial primary key not null,
          token integer unique not null,
          name varchar(50) not null
        );
        create table users (
          id serial primary key not null,
          email varchar(50) not null unique,
          team_id int references teams (id)
        );
        insert into teams (token, name) values (1, 'a');
        insert into users (email, team_id) values ('a', NULL);
        insert into users (email, team_id) values ('b', 1);
      `,
      down: `
        drop table if exists users cascade;
        drop table if exists teams cascade;
      `,
      do: async (client) => {
        return client.users.findMany({ where: { team_id: null } })
      },
      expect: [
        {
          email: 'a',
          team_id: null,
        },
      ],
    },
    {
      name: 'findMany where - case insensitive field',
      up: `
        create table users (
          id serial primary key not null,
          email varchar(50) not null unique COLLATE utf8mb4_unicode_ci 
        );
        insert into users (email) values ('max@prisma.io');
      `,
      down: `
        drop table if exists users cascade;
      `,
      do: async (client) => {
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
      name: 'findMany where decimal',
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
      do: async (client) => {
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
      name: 'findOne where decimal',
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
      do: async (client) => {
        return client.exercises.findOne({ where: { distance: 12.213 } })
      },
      expect: {
        distance: 12.213,
        id: 1,
      },
    },
    {
      todo: true,
      // null
      name: 'findOne where decimal - default value',
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
      do: async (client) => {
        return client.exercises.findOne({ where: { distance: 12.3 } })
      },
      expect: {
        distance: 12.3,
        id: 2,
      },
    },
    {
      name: 'create bigint data',
      up: `
        create table migrate (
          version bigint not null primary key
        );
      `,
      down: `
        drop table if exists migrate cascade;
      `,
      do: async (client) => {
        return client.migrate.create({ data: { version: 1 } })
      },
      expect: {
        version: 1,
      },
    },
    {
      name: 'findOne where composite PK',
      up: `
        create table variables (
          name varchar(50) not null,
          \`key\` varchar(50) not null,
          value varchar(50) not null,
          email varchar(50) not null,
          primary key(name, \`key\`)
        );
        insert into variables (name, \`key\`, value, email) values ('a', 'b', 'c', 'd');
      `,
      down: `
        drop table if exists variables cascade;
      `,
      do: async (client) => {
        return client.variables.findOne({
          where: { name_key: { key: 'b', name: 'a' } },
        })
      },
      expect: {
        email: 'd',
        key: 'b',
        name: 'a',
        value: 'c',
      },
    },
    {
      name: 'update where composite PK',
      up: `
        create table variables (
          name varchar(50) not null,
          \`key\` varchar(50) not null,
          value varchar(50) not null,
          email varchar(50) not null,
          primary key(name, \`key\`)
        );
        insert into variables (name, \`key\`, value, email) values ('a', 'b', 'c', 'd');
      `,
      down: `
        drop table if exists variables cascade;
      `,
      do: async (client) => {
        return client.variables.update({
          where: { name_key: { key: 'b', name: 'a' } },
          data: { email: 'e' },
        })
      },
      expect: {
        email: 'e',
        key: 'b',
        name: 'a',
        value: 'c',
      },
    },
    {
      name: 'upsert where composite PK - update',
      up: `
        create table variables (
          name varchar(50) not null,
          \`key\` varchar(50) not null,
          value varchar(50) not null,
          email varchar(50) not null,
          primary key(name, \`key\`)
        );
        insert into variables (name, \`key\`, value, email) values ('a', 'b', 'c', 'd');
      `,
      down: `
        drop table if exists variables cascade;
      `,
      do: async (client) => {
        return client.variables.upsert({
          where: { name_key: { key: 'b', name: 'a' } },
          create: { name: '1', key: '2', value: '3', email: '4' },
          update: { email: 'e' },
        })
      },
      expect: {
        email: 'e',
        key: 'b',
        name: 'a',
        value: 'c',
      },
    },
    {
      name: 'upsert where composite PK - create',
      up: `
        create table variables (
          name varchar(50) not null,
          \`key\` varchar(50) not null,
          value varchar(50) not null,
          email varchar(50) not null,
          primary key(name, \`key\`)
        );
        insert into variables (name, \`key\`, value, email) values ('a', 'b', 'c', 'd');
      `,
      down: `
        drop table if exists variables cascade;
      `,
      do: async (client) => {
        return client.variables.upsert({
          where: { name_key: { key: 'd', name: 'a' } },
          create: { name: '1', key: '2', value: '3', email: '4' },
          update: { email: 'e' },
        })
      },
      expect: {
        email: '4',
        key: '2',
        name: '1',
        value: '3',
      },
    },
    {
      name: 'delete where composite PK',
      up: `
        create table variables (
          name varchar(50) not null,
          \`key\` varchar(50) not null,
          value varchar(50) not null,
          email varchar(50) not null,
          primary key(name, \`key\`)
        );
        insert into variables (name, \`key\`, value, email) values ('a', 'b', 'c', 'd');
      `,
      down: `
        drop table if exists variables cascade;
      `,
      do: async (client) => {
        return client.variables.delete({
          where: { name_key: { key: 'b', name: 'a' } },
        })
      },
      expect: {
        email: 'd',
        key: 'b',
        name: 'a',
        value: 'c',
      },
    },
    {
      name: 'findOne where unique composite',
      up: `
        create table variables (
          id serial primary key not null,
          name varchar(50) not null,
          \`key\` varchar(50) not null,
          value varchar(50) not null,
          email varchar(50) not null,
          unique key variables_name_key_key(name, \`key\`)
        );
        insert into variables (name, \`key\`, value, email) values ('a', 'b', 'c', 'd');
      `,
      down: `
        drop table if exists variables cascade;
      `,
      do: async (client) => {
        return client.variables.findOne({
          where: { variables_name_key_key: { key: 'b', name: 'a' } },
        })
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
      name: 'findOne where unique composite (PK is a composite)',
      up: `
        create table variables (
          name varchar(50) not null,
          \`key\` varchar(50) not null,
          value varchar(50) not null,
          email varchar(50) not null,
          primary key(name, \`key\`),
          unique key variables_value_email_key(value, email)
        );
        insert into variables (name, \`key\`, value, email) values ('a', 'b', 'c', 'd');
      `,
      down: `
        drop table if exists variables cascade;
      `,
      do: async (client) => {
        return client.variables.findOne({
          where: { variables_value_email_key: { value: 'c', email: 'd' } },
        })
      },
      expect: {
        email: 'd',
        key: 'b',
        name: 'a',
        value: 'c',
      },
    },
    {
      name: 'findOne where composite PK with foreign key',
      up: `
          create table a (
            one integer not null,
            two integer not null,
            primary key (one, two)
          );
          create table b (
            id serial primary key not null,
            one integer not null,
            two integer not null
          );
          ALTER TABLE b ADD FOREIGN KEY (one, two) REFERENCES a(one, two);
          insert into a (one, two) values (1, 2);
          insert into b (one, two) values (1, 2);
        `,
      down: `
        drop table if exists b cascade;
        drop table if exists a cascade;
      `,
      do: async (client) => {
        return client.a.findOne({ where: { one_two: { one: 1, two: 2 } } })
      },
      expect: {
        one: 1,
        two: 2,
      },
    },
    {
      todo: true,
      name: 'findOne - list all possible datatypes',
      up: `
        create table crazy (
          c1 bigint,
          c2 int8,
          ...
        );
      `,
      down: `
        drop table if exists crazy cascade;
      `,
      do: async (client) => {
        return client.crazy.findOne({
          where: { value_email: { value: 'c', email: 'd' } },
        })
      },
      expect: {
        // TODO
      },
    },
    {
      name: 'updateMany where null - check findMany',
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
      do: async (client) => {
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
    {
      name: 'findMany on column_name_that_becomes_empty_string',
      up: `
        CREATE TABLE \`column_name_that_becomes_empty_string\` (
          \`field1\` int(11) NOT NULL AUTO_INCREMENT,
          \`12345\` int(11) DEFAULT NULL,
          PRIMARY KEY (\`field1\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=latin1;
        
        CREATE TABLE \`invalid_enum_value_name\` (
          \`field1\` int(11) NOT NULL AUTO_INCREMENT,
          \`here_be_enum\` enum('Y','N','123','$§!') DEFAULT NULL,
          PRIMARY KEY (\`field1\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=latin1;
        
        CREATE TABLE \`no_unique_identifier\` (
          \`field1\` int(11) DEFAULT NULL,
          \`field2\` int(11) DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=latin1;

        CREATE TABLE \`unsupported_type\` (
          \`field1\` int(11) NOT NULL AUTO_INCREMENT,
          \`unsupported\` binary(50) DEFAULT NULL,
          PRIMARY KEY (\`field1\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=latin1;
      `,
      down: `
        drop table if exists column_name_that_becomes_empty_string cascade;
        drop table if exists invalid_enum_value_name cascade;
        drop table if exists no_unique_identifier cascade;
        drop table if exists unsupported_type cascade;
      `,
      do: async (client) => {
        return await client.column_name_that_becomes_empty_string.findMany({})
      },
      expect: [],
    },
  ]
}

export function maskSchema(schema: string): string {
  const urlRegex = /url\s*=\s*.+/
  const outputRegex = /output\s*=\s*.+/
  return schema
    .split('\n')
    .map((line) => {
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
