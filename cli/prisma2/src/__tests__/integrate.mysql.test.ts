import { getGenerator, IntrospectionEngine } from '@prisma/sdk'
import { join, dirname } from 'path'
import mkdir from 'make-dir'
import assert from 'assert'
import pkgup from 'pkg-up'
import rimraf from 'rimraf'
import fs from 'fs'
import path from 'path'
import snapshot from 'snap-shot-it'
import mysql from 'mysql2/promise'
import { getLatestAlphaTag } from '@prisma/fetch-engine'

const connectionString = process.env.TEST_MYSQL_URI || 'mysql://root:password@localhost:3306/prisma-dev'
process.env.SKIP_GENERATE = 'true'

const pkg = pkgup.sync() || __dirname
const tmp = join(dirname(pkg), 'tmp-mysql')
const engine = new IntrospectionEngine()
const latestAlphaPromise = getLatestAlphaTag()

let db: mysql.Connection
before(async () => {
  db = await mysql.createConnection({
    uri: connectionString,
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
  run?: boolean
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
          name varchar(50) not null unique
        );
        insert into teams (id, name) values (1, 'a');
        insert into teams (id, name) values (2, 'b');
      `,
      down: `
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
      up: `
        create table teams (
          id serial primary key not null,
          name varchar(50) not null unique
        );
      `,
      down: `
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
      up: `
        create table teams (
          id serial primary key not null,
          name varchar(50) not null default 'alice'
        );
      `,
      down: `
        drop table if exists teams cascade;
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
          name varchar(50) not null unique
        );
        insert into teams (name) values ('c');
      `,
      down: `
        drop table if exists teams cascade;
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
          name varchar(50) not null unique,
          active boolean not null default true
        );
        insert into teams (name) values ('c');
      `,
      down: `
        drop table if exists teams cascade;
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
          name varchar(50) not null unique,
          active boolean not null default true
        );
        insert into teams (name) values ('c');
      `,
      down: `
        drop table if exists teams cascade;
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
          name varchar(50) not null unique
        );
        insert into teams (name) values ('c');
      `,
      down: `
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
          name varchar(50) not null
        );
        insert into teams (name) values ('c');
        insert into teams (name) values ('c');
      `,
      down: `
        drop table if exists teams cascade;
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
          email varchar(50) not null unique
        );
        insert into users (email) values ('ada@prisma.io');
      `,
      down: `
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
          email varchar(50) not null,
          name varchar(50) not null,
          unique key users_email_name_key(email, name)
        );
        insert into users (email, name) values ('ada@prisma.io', 'Ada');
      `,
      down: `
        drop table if exists users cascade;
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
          email varchar(50) not null,
          name varchar(50) not null,
          unique key users_email_name_key(email, name)
        );
        insert into users (email, name) values ('ada@prisma.io', 'Ada');
      `,
      down: `
        drop table if exists users cascade;
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
        insert into users (email) values ('ada@prisma.io');
        insert into users (email) values (null);
      `,
      down: `
        drop table if exists users cascade;
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
          email varchar(50) not null unique
        );
        insert into users (email) values ('ada@prisma.io');
      `,
      down: `
        drop table if exists users cascade;
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
          email varchar(50) not null unique
        );
        insert into users (email) values ('ada@prisma.io');
        insert into users (email) values ('ema@prisma.io');
      `,
      down: `
        drop table if exists users cascade;
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
      do: async client => {
        return client.users.findOne({ where: { email: 'ada@prisma.io' } }).posts()
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
      do: async client => {
        return client.posts.create({ data: { title: 'D' } })
      },
      expect: {},
    },
    {
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
      do: async client => {
        return client.posts.findMany({ where: { created_at: { gte: new Date() } } })
      },
      expect: [],
    },
    {
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
      do: async client => {
        return client.posts.findMany({ where: { created_at: { gt: new Date() } } })
      },
      expect: [],
    },
    {
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
      do: async client => {
        return client.teams.update({ where: { token: 11 }, data: { token: 10 } })
      },
      expect: {
        id: 1,
        token: 10,
      },
    },
    {
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
      do: async client => {
        return client.events.findMany({ where: { time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } })
      },
      expect: [
        {
          id: 1,
          time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)),
        },
      ],
    },
    {
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
      do: async client => {
        return client.events.findMany({ where: { time: { gt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })
      },
      expect: [],
    },
    {
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
      do: async client => {
        return client.events.findMany({ where: { time: { gte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })
      },
      expect: [
        {
          id: 1,
          time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)),
        },
      ],
    },
    {
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
      do: async client => {
        return client.events.findMany({ where: { time: { lt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })
      },
      expect: [],
    },
    {
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
      do: async client => {
        return client.events.findMany({ where: { time: { lte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })
      },
      expect: [
        {
          id: 1,
          time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)),
        },
      ],
    },
    {
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
      do: async client => {
        return client.events.findMany({ where: { time: { not: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } } })
      },
      expect: [],
    },
    {
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
      do: async client => {
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
          name varchar(50) not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
      down: `
        drop table if exists teams cascade;
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
          name varchar(50) not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
      down: `
        drop table if exists teams cascade;
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
          name varchar(50) not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
      down: `
        drop table if exists teams cascade;
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
          name varchar(50) not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
      down: `
        drop table if exists teams cascade;
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
      do: async client => {
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
      do: async client => {
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
      do: async client => {
        return client.migrate.create({ data: { version: 1 } })
      },
      expect: {
        version: 1,
      },
    },
    {
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
      do: async client => {
        return client.variables.findOne({ where: { name_key: { key: 'b', name: 'a' } } })
      },
      expect: {
        email: 'd',
        key: 'b',
        name: 'a',
        value: 'c',
      },
    },
    {
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
      do: async client => {
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
      do: async client => {
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
      do: async client => {
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
      do: async client => {
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
      do: async client => {
        return client.a.findOne({ where: { one_two: { one: 1, two: 2 } } })
      },
      expect: {
        one: 1,
        two: 2,
      },
    },
    {
      todo: true,
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
      do: async client => {
        return client.crazy.findOne({ where: { value_email: { value: 'c', email: 'd' } } })
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
