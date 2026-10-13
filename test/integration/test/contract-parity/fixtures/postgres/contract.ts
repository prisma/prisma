/**
 * The field presets, id generators, parameterized codecs and relation shapes the planner golden fixture leaves out, so the parity test compares them with their emitted types.
 */

import { int4Column, textColumn } from '@internal/adapter-postgres/column-types';
import { arktypeJson } from '@internal/extension-arktype-json/column-types';
import arktypeJsonPack from '@internal/extension-arktype-json/pack';
import { cuid2, ksuid, nanoid, ulid, uuidv4, uuidv7 } from '@internal/ids';
import {
  defineContract,
  field,
  fullTextIndex,
  model,
  rel,
} from '@internal/postgres/contract-builder';
import { type } from 'arktype';

const timestampString3 = {
  kind: 'codec-instance',
  codecId: 'pg/timestamp-string@1',
  typeParams: { precision: 3 },
} as const;
const timestamptzString3 = {
  kind: 'codec-instance',
  codecId: 'pg/timestamptz-string@1',
  typeParams: { precision: 3 },
} as const;

const pgVarchar20 = { codecId: 'pg/varchar@1', typeParams: { length: 20 } } as const;

const User = model('User', {
  fields: {
    id: field.id.uuidv7String(),
    email: field.column(textColumn),
    externalId: field.uuidString(),
    ulid: field.ulid(),
    nanoid: field.nanoid(),
    shortNanoid: field.nanoid({ size: 10 }),
    cuid2: field.cuid2(),
    ksuid: field.ksuid(),
    createdAt: field.temporal.createdAt(),
    updatedAt: field.temporal.updatedAt(),
    timestamp: field.temporal.timestamp(3),
    timestamptz: field.temporal.timestamptz(6, 'now'),
    timestampString: field.temporal.timestampString(3),
    timestamptzString: field.temporal.timestamptzString(3, 'now', 'now'),
    timestampStringAlias: field.namedType(timestampString3),
    timestamptzStringAlias: field.namedType(timestamptzString3).optional(),
    seenAt: field.temporal.timestamptzJsDate(3),
    handle: field.column(pgVarchar20),
  },
});

const Post = model('Post', {
  fields: {
    id: field.id.uuidv4String(),
    authorId: field.uuidString(),
    title: field.column(textColumn),
  },
});

const Tag = model('Tag', {
  fields: { id: field.id.ulid(), label: field.column(textColumn) },
});

const PostTag = model('PostTag', {
  fields: { postId: field.uuidString(), tagId: field.ulid() },
});

const Generated = model('Generated', {
  fields: {
    id: field.generated(uuidv4()).id(),
    uuidv7: field.generated(uuidv7()),
    ulid: field.generated(ulid()),
    nanoid: field.generated(nanoid()),
    shortNanoid: field.generated(nanoid({ size: 12 })),
    cuid2: field.generated(cuid2()),
    ksuid: field.generated(ksuid()),
  },
});

const Employee = model('Employee', {
  fields: { id: field.id.nanoid(), managerId: field.nanoid().optional() },
});

const Badge = model('Badge', {
  fields: { id: field.column(int4Column), code: field.column(textColumn).unique() },
});

const UserBadge = model('UserBadge', {
  fields: { userId: field.uuidString(), badgeCode: field.column(textColumn) },
});

const Account = model('Account', {
  namespace: 'auth',
  fields: { id: field.id.cuid2(), userId: field.uuidString(), provider: field.column(textColumn) },
});

const Profile = model('Profile', {
  fields: {
    id: field.id.ksuid(),
    userId: field.uuidString(),
    rank: field.column(int4Column),
    settings: field.column(arktypeJson(type({ theme: 'string', fontSize: 'number' }))),
  },
});

export const contract = defineContract({
  extensions: { 'arktype-json': arktypeJsonPack },
  namespaces: ['auth'],
  types: { TimestampString3: timestampString3, TimestamptzString3: timestamptzString3 },
  models: {
    User: User.relations({
      posts: rel.hasMany(Post, { by: 'authorId' }),
      accounts: rel.hasMany(Account, { by: 'userId' }),
      profile: rel.hasOne(Profile, { by: 'userId' }),
      badges: rel.manyToMany(Badge, { through: UserBadge, from: 'userId', to: 'badgeCode' }),
    }).sql(({ cols, constraints }) => ({
      table: 'users',
      indexes: [
        constraints.index([cols.handle]),
        constraints.index([cols.email], { map: 'users_email_exact' }),
        constraints.index([cols.nanoid, cols.cuid2], { name: 'by_short_ids', unique: true }),
        fullTextIndex([[cols.email], cols.handle], { name: 'search_docs', language: 'german' }),
      ],
    })),
    Badge: Badge.sql({ table: 'badges' }),
    UserBadge: UserBadge.sql({ table: 'user_badges' }),
    Post: Post.relations({
      author: rel.belongsTo(User, { from: 'authorId', to: 'id' }),
      tags: rel.manyToMany(Tag, { through: PostTag, from: 'postId', to: 'tagId' }),
    }).sql(({ cols, constraints }) => ({
      table: 'posts',
      foreignKeys: [constraints.foreignKey(cols.authorId, User.refs.id)],
    })),
    Tag: Tag.relations({
      posts: rel.manyToMany(Post, { through: PostTag, from: 'tagId', to: 'postId' }),
    }).sql({ table: 'tags' }),
    PostTag: PostTag.sql({ table: 'post_tags' }),
    Generated: Generated.sql({ table: 'generated' }),
    Employee: Employee.relations({
      manager: rel.belongsTo(Employee, { from: 'managerId', to: 'id' }),
      reports: rel.hasMany(Employee, { by: 'managerId' }),
    }).sql({ table: 'employees' }),
    Account: Account.relations({
      user: rel.belongsTo(User, { from: 'userId', to: 'id' }),
    }).sql({ table: 'accounts' }),
    Profile: Profile.relations({
      user: rel.belongsTo(User, { from: 'userId', to: 'id' }).sql({ fk: { onDelete: 'cascade' } }),
    }).sql({ table: 'profiles' }),
  },
});
