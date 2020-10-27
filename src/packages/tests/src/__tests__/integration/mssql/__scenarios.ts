import { Input } from '../../__helpers__/integrationTest'

export const scenarios = [
  {
    name: 'findOne where PK',
    up: `
        create table teams (
          id int primary key not null,
          name varchar(32) not null unique
        );
        insert into teams (id, name) values (1, 'a');
        insert into teams (id, name) values (2, 'b');
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
    name: 'findOne where PK with select',
    up: `
        create table teams (
          id int primary key not null,
          name varchar(32) not null unique,
          email varchar(32) not null unique
        );
        insert into teams (id, name, email) values (1, 'a', 'a@a');
        insert into teams (id, name, email) values (2, 'b', 'b@b');
      `,
    do: async client => {
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
          id int identity primary key not null,
          email varchar(32) not null unique
        );
        create table posts (
          id int identity primary key not null,
          user_id int not null references users (id) on update cascade,
          title varchar(32) not null
        );
        insert into users ("email") values ('ada@prisma.io');
        insert into users ("email") values ('ema@prisma.io');
        insert into posts ("user_id", "title") values (1, 'A');
        insert into posts ("user_id", "title") values (1, 'B');
        insert into posts ("user_id", "title") values (2, 'C');
      `,
    do: async client => {
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
          id int identity primary key not null,
          name varchar(32) not null unique
        );
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
    name: 'create with empty data and SQL default',
    up: `
        create table teams (
          id int identity primary key not null,
          name varchar(32) not null default 'alice'
        );
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
    name: 'create with empty data and identity',
    up: `
        create table teams (
          id int identity primary key not null
        );
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
    name: 'update where with numeric data',
    up: `
        create table teams (
          id int identity primary key not null,
          name varchar(32) not null unique
        );
        insert into teams ("name") values ('c');
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
    name: 'update where with boolean data',
    up: `
        create table teams (
          id int identity primary key not null,
          name varchar(32) not null unique,
          active bit not null default 1
        );
        insert into teams ("name") values ('c');
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
    name: 'update where with boolean data and select',
    up: `
        create table teams (
          id int identity primary key not null,
          name varchar(32) not null unique,
          active bit not null default 1
        );
        insert into teams ("name") values ('c');
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
    name: 'update where with string data',
    up: `
        create table teams (
          id int identity primary key not null,
          name varchar(32) not null unique
        );
        insert into teams ("name") values ('c');
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
    name: 'updateMany where with string data - check returned count',
    up: `
        create table teams (
          id int identity primary key not null,
          name varchar(32) not null
        );
        insert into teams ("name") values ('c');
        insert into teams ("name") values ('c');
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
    name: 'updateMany where with string data - check findMany',
    up: `
        create table teams (
          id int identity primary key not null,
          name varchar(32) not null
        );
        insert into teams ("name") values ('c');
        insert into teams ("name") values ('c');
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
    name: 'findOne where unique',
    up: `
        create table users (
          id int identity primary key not null,
          email varchar(32) not null unique
        );
        insert into users ("email") values ('ada@prisma.io');
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
    name: 'findOne where composite unique',
    up: `
        create table users (
          id int identity primary key not null,
          email varchar(32) not null,
          name varchar(32) not null,
          constraint u_const unique(email, name)
        );
        insert into users ("email", "name") values ('ada@prisma.io', 'Ada');
      `,
    do: async client => {
      return client.users.findOne({
        where: {
          u_const: { email: 'ada@prisma.io', name: 'Ada' },
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
          id int identity primary key not null,
          email varchar(32) not null,
          name varchar(32) not null,
          constraint u_const unique(email, name)
        );
        insert into users ("email", "name") values ('ada@prisma.io', 'Ada');
      `,
    do: async client => {
      return client.users.update({
        where: {
          u_const: { email: 'ada@prisma.io', name: 'Ada' },
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
          id int identity primary key not null,
          email varchar(32) not null,
          name varchar(32) not null,
          constraint u_const unique(email, name)
        );
        insert into users ("email", "name") values ('ada@prisma.io', 'Ada');
      `,
    do: async client => {
      return client.users.delete({
        where: {
          u_const: { email: 'ada@prisma.io', name: 'Ada' },
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
          id int identity primary key not null,
          email varchar(32)
        );
        insert into users ("email") values ('ada@prisma.io');
        insert into users ("email") values (null);
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
    name: 'findMany where unique',
    up: `
        create table users (
          id int identity primary key not null,
          email varchar(32) not null unique
        );
        insert into users ("email") values ('ada@prisma.io');
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
    name: 'findMany - email varchar(50) not null unique',
    up: `
        create table users (
          id int identity primary key not null,
          email varchar(32) not null unique
        );
        insert into users ("email") values ('ada@prisma.io');
        insert into users ("email") values ('ema@prisma.io');
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
    name: 'findOne where unique with foreign key and unpack',
    up: `
        create table users (
          id int identity primary key not null,
          email varchar(32) not null unique
        );
        create table posts (
          id int identity primary key not null,
          user_id int not null references users (id) on update cascade,
          title varchar(32) not null
        );
        insert into users ("email") values ('ada@prisma.io');
        insert into users ("email") values ('ema@prisma.io');
        insert into posts ("user_id", "title") values (1, 'A');
        insert into posts ("user_id", "title") values (1, 'B');
        insert into posts ("user_id", "title") values (2, 'C');
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
    name: 'findMany where contains and boolean',
    up: `
        create table posts (
          id int identity primary key not null,
          title varchar(32) not null,
          published bit not null default 0
        );
        insert into posts ("title", "published") values ('A', 1);
        insert into posts ("title", "published") values ('B', 0);
        insert into posts ("title", "published") values ('C', 1);
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
    name: 'findMany where OR[contains, contains] ',
    up: `
        create table posts (
          id int identity primary key not null,
          title varchar(32) not null,
          published bit not null default 0
        );
        insert into posts ("title", "published") values ('A', 1);
        insert into posts ("title", "published") values ('B', 0);
        insert into posts ("title", "published") values ('C', 1);
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
    name: 'upsert (update)',
    up: `
        create table posts (
          id int identity primary key not null,
          title varchar(32) not null,
          published bit not null default 0
        );
        insert into posts ("title", "published") values ('A', 1);
        insert into posts ("title", "published") values ('B', 0);
        insert into posts ("title", "published") values ('C', 1);
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
    name: 'upsert (create)',
    up: `
        create table posts (
          id int identity primary key not null,
          title varchar(32) not null,
          published bit not null default 0
        );
        insert into posts ("title", "published") values ('A', 1);
        insert into posts ("title", "published") values ('B', 0);
        insert into posts ("title", "published") values ('C', 1);
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
    name: 'findMany orderBy asc',
    up: `
        create table posts (
          id int identity primary key not null,
          title varchar(32) not null,
          published bit not null default 0
        );
        insert into posts ("title", "published") values ('A', 1);
        insert into posts ("title", "published") values ('B', 0);
        insert into posts ("title", "published") values ('C', 1);
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
    name: 'findMany orderBy desc',
    up: `
        create table posts (
          id int identity primary key not null,
          title varchar(32) not null,
          published bit not null default 0
        );
        insert into posts ("title", "published") values ('A', 1);
        insert into posts ("title", "published") values ('B', 0);
        insert into posts ("title", "published") values ('C', 1);
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
    name: 'findMany where contains',
    up: `
        create table crons (
          id int identity not null primary key,
          "job" varchar(32) unique not null,
          frequency varchar(32)
        );
        insert into crons ("job", "frequency") values ('j1', '* * * * *');
        insert into crons ("job", "frequency") values ('j20', '* * * * 1-5');
        insert into crons ("job", "frequency") values ('j21', '* * * * 1-5');
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
    name: 'findMany where startsWith',
    up: `
        create table crons (
          id int identity not null primary key,
          "job" varchar(32) unique not null,
          frequency varchar(32)
        );
        insert into crons ("job", "frequency") values ('j1', '* * * * *');
        insert into crons ("job", "frequency") values ('j20', '* * * * 1-5');
        insert into crons ("job", "frequency") values ('j21', '* * * * 1-5');
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
    name: 'findMany where endsWith',
    up: `
        create table crons (
          id int identity not null primary key,
          "job" varchar(32) unique not null,
          frequency varchar(32)
        );
        insert into crons ("job", "frequency") values ('j1', '* * * * *');
        insert into crons ("job", "frequency") values ('j20', '* * * * 1-5');
        insert into crons ("job", "frequency") values ('j21', '* * * * 1-5');
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
    name: 'findMany where in[string]',
    up: `
        create table crons (
          id int identity not null primary key,
          "job" varchar(32) unique not null,
          frequency varchar(32)
        );
        insert into crons ("job", "frequency") values ('j1', '* * * * *');
        insert into crons ("job", "frequency") values ('j20', '* * * * 1-5');
        insert into crons ("job", "frequency") values ('j21', '* * * * 1-5');
      `,
    do: async client => {
      return client.crons.findMany({
        where: { job: { in: ['j20', 'j1'] } },
      })
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
          id int identity not null primary key,
          "job" varchar(32) unique not null,
          frequency varchar(32)
        );
        insert into crons ("job", "frequency") values ('j1', '* * * * *');
        insert into crons ("job", "frequency") values ('j20', '* * * * 1-5');
        insert into crons ("job", "frequency") values ('j21', '* * * * 1-5');
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
    name: 'findMany where datetime lte - check instanceof Date',
    up: `
        create table posts (
          id int identity primary key not null,
          title varchar(32) not null,
          created_at datetime not null default getdate()
        );
        insert into posts ("title", "created_at") values ('A', '2020-01-14T11:10:19.573Z');
        insert into posts ("title", "created_at") values ('B', '2020-01-14T11:10:19.573Z');
        insert into posts ("title", "created_at") values ('C', '2020-01-14T11:10:19.573Z');
      `,
    // todo: true,
    do: async client => {
      const posts = await client.posts.findMany({
        where: { created_at: { lte: new Date() } },
      })
      posts.forEach(post => {
        expect(post.created_at).toBeInstanceOf(Date)
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
    name: 'findMany where datetime gte than now',
    up: `
        create table posts (
          id int identity primary key not null,
          title varchar(32) not null,
          created_at datetime not null default getdate()
        );
        insert into posts ("title", "created_at") values ('A', '2020-01-14T11:10:19.573Z');
        insert into posts ("title", "created_at") values ('B', '2020-01-14T11:10:19.573Z');
        insert into posts ("title", "created_at") values ('C', '2020-01-14T11:10:19.573Z');
      `,
    do: async client => {
      return client.posts.findMany({
        where: { created_at: { gte: new Date() } },
      })
    },
    expect: [],
  },
  {
    name: 'findMany where datetime gt than now',
    up: `
        create table posts (
          id int identity primary key not null,
          title varchar(32) not null,
          created_at datetime not null default getdate()
        );
        insert into posts ("title", "created_at") values ('A', '2020-01-14T11:10:19.573Z');
        insert into posts ("title", "created_at") values ('B', '2020-01-14T11:10:19.573Z');
        insert into posts ("title", "created_at") values ('C', '2020-01-14T11:10:19.573Z');
      `,
    do: async client => {
      return client.posts.findMany({
        where: { created_at: { gt: new Date() } },
      })
    },
    expect: [],
  },
  {
    name: 'findMany where datetime lt than now',
    up: `
        create table posts (
          id int identity primary key not null,
          title varchar(32) not null,
          created_at datetime not null default getdate()
        );
        insert into posts ("title", "created_at") values ('A', '2020-01-14T11:10:19.573Z');
        insert into posts ("title", "created_at") values ('B', '2020-01-14T11:10:19.573Z');
        insert into posts ("title", "created_at") values ('C', '2020-01-14T11:10:19.573Z');
      `,
    do: async client => {
      const posts = await client.posts.findMany({
        where: { created_at: { lt: new Date() } },
      })
      posts.forEach(post => {
        expect(post.created_at).toBeInstanceOf(Date)
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
          id int identity primary key not null,
          token integer unique not null
        );
        insert into teams (token) values (11);
      `,
    do: async client => {
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
          id int identity not null primary key,
          "time" datetime
        );

        insert into events ("time") values ('2018-09-04T00:00:00.000Z');
      `,
    do: async client => {
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
          id int identity not null primary key,
          "time" datetime
        );

        insert into events ("time") values ('2018-09-04T00:00:00.000Z');
      `,
    do: async client => {
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
          id int identity not null primary key,
          "time" datetime
        );

        insert into events ("time") values ('2018-09-04T00:00:00.000Z');
      `,
    do: async client => {
      return client.events.findMany({
        where: {
          time: { gte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) },
        },
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
          id int identity not null primary key,
          "time" datetime
        );

        insert into events ("time") values ('2018-09-04T00:00:00.000Z');
      `,
    do: async client => {
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
          id int identity not null primary key,
          "time" datetime
        );

        insert into events ("time") values ('2018-09-04T00:00:00.000Z');
      `,
    do: async client => {
      return client.events.findMany({
        where: {
          time: { lte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) },
        },
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
          id int identity not null primary key,
          "time" datetime
        );

        insert into events ("time") values ('2018-09-04T00:00:00.000Z');
      `,
    do: async client => {
      return client.events.findMany({
        where: {
          time: { not: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) },
        },
      })
    },
    expect: [],
  },
  {
    name: 'findMany where null',
    up: `
        create table events (
          id int identity not null primary key,
          "time" datetime
        );

        insert into events ("time") values (NULL);
        insert into events ("time") values (NULL);
        insert into events ("time") values (NULL);
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
    name: 'findMany where empty in[]',
    up: `
        create table teams (
          id int identity primary key not null,
          token integer unique not null,
          name varchar(32) not null
        );

        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
    do: async client => {
      return client.teams.findMany({ where: { id: { in: [] } } })
    },
    expect: [],
  },
  {
    name: 'findMany where id empty in[] and token in[]',
    up: `
        create table teams (
          id int identity primary key not null,
          token integer unique not null,
          name varchar(32) not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
    do: async client => {
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
          id int identity primary key not null,
          token integer unique not null,
          name varchar(32) not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
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
    name: 'findMany where notIn[]',
    up: `
        create table teams (
          id int identity primary key not null,
          token integer unique not null,
          name varchar(32) not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
      `,
    do: async client => {
      return client.teams.findMany({
        where: { token: { notIn: [11, 22] } },
      })
    },
    expect: [],
  },
  {
    name: 'findMany where empty notIn[]',
    up: `
        create table teams (
          id int identity primary key not null,
          token integer unique not null,
          name varchar(32) not null
        );
        insert into teams (token, name) values (11, 'a');
        insert into teams (token, name) values (22, 'b');
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
    name: 'findMany where null',
    up: `
        create table teams (
          id int identity primary key not null,
          token integer unique not null,
          name varchar(32) not null
        );
        create table users (
          id int identity primary key not null,
          email varchar(32) not null unique,
          team_id int references teams (id)
        );
        insert into teams ("token", "name") values (1, 'a');
        insert into users ("email", team_id) values ('a', NULL);
        insert into users ("email", "team_id") values ('b', 1);
      `,
    do: async client => {
      return client.users.findMany({ where: { team_id: null } })
    },
    expect: [
      {
        id: 1,
        email: 'a',
        team_id: null,
      },
    ],
  },
  {
    name: 'findMany where decimal',
    up: `
        create table exercises (
          id int identity primary key not null,
          distance decimal(5, 3) not null
        );
        insert into exercises (distance) values (12.213);
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
    name: 'findOne where decimal',
    up: `
        create table exercises (
          id int identity primary key not null,
          distance decimal(5, 3) not null unique
        );
        insert into exercises (distance) values (12.213);
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
    name: 'findOne where decimal - default value',
    up: `
        create table exercises (
          id int identity primary key not null,
          distance decimal(5, 3) not null unique default (12.3)
        );

        insert into exercises (distance) values (12.213);
        insert into exercises default values;
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
    name: 'create bigint data',
    up: `
        create table migrate (
          version bigint not null primary key
        );
      `,
    do: async client => {
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
          name varchar(32) not null,
          "key" varchar(32) not null,
          value varchar(32) not null,
          email varchar(32) not null,
          constraint pk_const primary key(name, "key")
        );
        insert into variables (name, "key", value, email) values ('a', 'b', 'c', 'd');
      `,
    do: async client => {
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
          name varchar(32) not null,
          "key" varchar(32) not null,
          value varchar(32) not null,
          email varchar(32) not null,
          constraint pk_const primary key(name, "key")
        );
        insert into variables (name, "key", value, email) values ('a', 'b', 'c', 'd');
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
    name: 'upsert where composite PK - update',
    up: `
        create table variables (
          name varchar(32) not null,
          "key" varchar(32) not null,
          value varchar(32) not null,
          email varchar(32) not null,
          constraint pk_const primary key(name, "key")
        );
        insert into variables (name, "key", value, email) values ('a', 'b', 'c', 'd');
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
    name: 'upsert where composite PK - create',
    up: `
        create table variables (
          name varchar(32) not null,
          "key" varchar(32) not null,
          value varchar(32) not null,
          email varchar(32) not null,
          constraint pk_const primary key(name, "key")
        );
        insert into variables (name, "key", value, email) values ('a', 'b', 'c', 'd');
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
    name: 'delete where composite PK',
    up: `
        create table variables (
          name varchar(32) not null,
          "key" varchar(32) not null,
          value varchar(32) not null,
          email varchar(32) not null,
          constraint pk_const primary key(name, "key")
        );
        insert into variables (name, "key", value, email) values ('a', 'b', 'c', 'd');
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
    name: 'findOne where unique composite',
    up: `
        create table variables (
          id int identity primary key not null,
          name varchar(32) not null,
          "key" varchar(32) not null,
          value varchar(32) not null,
          email varchar(32) not null,
          constraint u_const unique(name, "key")
        );
        insert into variables (name, "key", value, email) values ('a', 'b', 'c', 'd');
      `,
    do: async client => {
      return client.variables.findOne({
        where: { u_const: { key: 'b', name: 'a' } },
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
          name varchar(32) not null,
          "key" varchar(32) not null,
          value varchar(32) not null,
          email varchar(32) not null,
          constraint pk_const primary key(name, "key"),
          constraint u_const unique(value, email)
        );
        insert into variables (name, "key", value, email) values ('a', 'b', 'c', 'd');
      `,
    do: async client => {
      return client.variables.findOne({
        where: { u_const: { value: 'c', email: 'd' } },
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
            primary key ("one", "two")
          );
          create table b (
            id int identity primary key not null,
            one integer not null,
            two integer not null,
            foreign key ("one", "two") references a ("one", "two")
          );
          insert into a ("one", "two") values (1, 2);
          insert into b ("one", "two") values (1, 2);
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
    name: 'findOne - list all possible datatypes',
    up: `
        create table crazy (
          c1 int,
          c2 bigint,
          c3 smallint,
          c4 tinyint,
          c5 numeric(10,5),
          c6 decimal(10,5),
          c7 bit,
          c8 money,
          c9 smallmoney,
          c10 float,
          c11 float(8),
          c12 real,
          c13 date,
          c14 datetimeoffset,
          c15 datetimeoffset(5),
          c16 datetime2,
          c17 datetime2(5),
          c18 smalldatetime,
          c19 datetime,
          c20 time,
          c21 time(5),
          c22 char(16),
          c23 varchar(16),
          c24 ntext,
          c25 text,
          c26 image,
          c27 nchar,
          c28 nchar(16),
          c29 nvarchar,
          c30 nvarchar(16),
          c31 binary,
          c32 binary(16),
          c33 varbinary,
          c34 rowversion,
          c35 uniqueidentifier,
          c36 geometry,
        );
      `,
    do: async client => {
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
          id int identity primary key not null,
          name varchar(32)
        );
        insert into teams (name) values ('a');
        insert into teams (name) values (NULL);
        insert into teams (name) values (NULL);
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
] as Input['scenarios']
