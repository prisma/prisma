import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import { defineContract, rel } from '../../src/exports/contract-builder';
import mysql from '../../src/runtime/mysql';
import { contractFromJson } from '../../src/static/contract-from-json';
import type { Contract } from '../fixtures/generated/contract.d';
import contractJson from '../fixtures/generated/contract.json' with { type: 'json' };
import { exampleDatabase, withSeededDatabase } from './live-database';

const contract = contractFromJson<Contract>(contractJson);

const eventsContract = defineContract({}, ({ field, model, type }) => {
  const Account = model('Account', {
    fields: { id: field.column(type.Int()).id(), name: field.column(type.String()) },
  });
  const Event = model('Event', {
    fields: {
      id: field.column(type.BigInt()).id(),
      at: field.column(type.DateTime()),
      accountId: field.column(type.Int()),
    },
  });
  return {
    models: {
      Account: Account.relations({ events: rel.hasMany(Event, { by: 'accountId' }) }),
      Event: Event.relations({
        account: rel.belongsTo(Account, { from: 'accountId', to: 'id' }),
      }),
    },
  };
});

const eventsDatabase = [
  'CREATE TABLE `Account` (`id` int NOT NULL, `name` varchar(191) NOT NULL, PRIMARY KEY (`id`))',
  'CREATE TABLE `Event` (`id` bigint NOT NULL, `at` datetime(3) NOT NULL, `accountId` int NOT NULL, PRIMARY KEY (`id`))',
  "INSERT INTO `Account` VALUES (1, 'main')",
  "INSERT INTO `Event` VALUES (9007199254740993, '2024-01-02 03:04:05.678', 1), (2, '2024-01-02 03:04:05.000', 1)",
] as const;

describe('MySQL includes through the ORM', { timeout: timeouts.databaseOperation }, () => {
  it('includes the row a to-one relation points at', async (test) => {
    await withSeededDatabase(test, exampleDatabase, async (url) => {
      await using db = mysql({ contract, url, verifyMarker: false });
      const posts = await db.orm.Post.select('id', 'title')
        .include('author', (author) => author.select('id', 'email'))
        .orderBy((p) => p.id.asc())
        .all();
      expect(posts).toEqual([
        { id: 1, title: 'Alpha', author: { id: 1, email: 'b@example.com' } },
        { id: 2, title: 'Gamma', author: { id: 1, email: 'b@example.com' } },
        { id: 3, title: 'Beta', author: { id: 1, email: 'b@example.com' } },
        { id: 4, title: 'Delta', author: { id: 2, email: 'a@example.com' } },
      ]);
    });
  });

  it('keeps a to-many include in the order it asks for, both ways', async (test) => {
    await withSeededDatabase(test, exampleDatabase, async (url) => {
      await using db = mysql({ contract, url, verifyMarker: false });
      const withPosts = (dir: 'asc' | 'desc') =>
        db.orm.User.select('id')
          .include('posts', (posts) =>
            posts.select('title').orderBy((p) => (dir === 'asc' ? p.title.asc() : p.title.desc())),
          )
          .first({ id: 1 });
      expect({ desc: await withPosts('desc'), asc: await withPosts('asc') }).toEqual({
        desc: { id: 1, posts: [{ title: 'Gamma' }, { title: 'Beta' }, { title: 'Alpha' }] },
        asc: { id: 1, posts: [{ title: 'Alpha' }, { title: 'Beta' }, { title: 'Gamma' }] },
      });
    });
  });

  it('limits and skips the rows of a to-many include', async (test) => {
    await withSeededDatabase(test, exampleDatabase, async (url) => {
      await using db = mysql({ contract, url, verifyMarker: false });
      const user = await db.orm.User.select('id')
        .include('posts', (posts) =>
          posts
            .select('title')
            .orderBy((p) => p.title.asc())
            .offset(1)
            .limit(1),
        )
        .first({ id: 1 });
      expect(user).toEqual({ id: 1, posts: [{ title: 'Beta' }] });
    });
  });

  it('includes two levels deep, and an empty to-many include as an empty array', async (test) => {
    await withSeededDatabase(test, exampleDatabase, async (url) => {
      await using db = mysql({ contract, url, verifyMarker: false });
      const users = await db.orm.User.select('id')
        .include('posts', (posts) =>
          posts
            .select('title')
            .orderBy((p) => p.id.desc())
            .include('author', (author) => author.select('email')),
        )
        .orderBy((u) => u.id.asc())
        .all();
      expect(users).toEqual([
        {
          id: 1,
          posts: [
            { title: 'Beta', author: { email: 'b@example.com' } },
            { title: 'Gamma', author: { email: 'b@example.com' } },
            { title: 'Alpha', author: { email: 'b@example.com' } },
          ],
        },
        { id: 2, posts: [{ title: 'Delta', author: { email: 'a@example.com' } }] },
        { id: 3, posts: [] },
        { id: 4, posts: [] },
      ]);
    });
  });

  it('returns whole rows for the include calls the project spec shows', async (test) => {
    await withSeededDatabase(test, exampleDatabase, async (url) => {
      await using db = mysql({ contract, url, verifyMarker: false });
      const withPosts = await db.orm.User.include('posts', (posts) =>
        posts.orderBy((p) => p.title.desc()),
      ).first({ id: 1 });
      const authors = await db.orm.Post.include('author')
        .orderBy((p) => p.id.asc())
        .all();
      const b = { id: 1, email: 'b@example.com', role: 'ADMIN' };
      const a = { id: 2, email: 'a@example.com', role: 'ADMIN' };
      expect({ withPosts, authors }).toEqual({
        withPosts: {
          ...b,
          posts: [
            { id: 2, title: 'Gamma', authorId: 1 },
            { id: 3, title: 'Beta', authorId: 1 },
            { id: 1, title: 'Alpha', authorId: 1 },
          ],
        },
        authors: [
          { id: 1, title: 'Alpha', authorId: 1, author: b },
          { id: 2, title: 'Gamma', authorId: 1, author: b },
          { id: 3, title: 'Beta', authorId: 1, author: b },
          { id: 4, title: 'Delta', authorId: 2, author: a },
        ],
      });
    });
  });

  it('keeps a bigint past 2^53 and a datetime(3) exact inside an include', async (test) => {
    await withSeededDatabase(test, eventsDatabase, async (url) => {
      await using db = mysql({ contract: eventsContract, url, verifyMarker: false });
      const account = await db.orm.Account.select('id')
        .include('events', (events) => events.select('id', 'at').orderBy((e) => e.id.desc()))
        .first({ id: 1 });
      expect(account).toEqual({
        id: 1,
        events: [
          { id: 9007199254740993n, at: new Date('2024-01-02T03:04:05.678Z') },
          { id: 2n, at: new Date('2024-01-02T03:04:05.000Z') },
        ],
      });
    });
  });
});
