/**
 * The field presets, id generators, parameterized codecs and relation shapes the planner golden fixture leaves out, so the parity test compares them with their emitted types.
 */

import { int4Column, textColumn } from '@internal/adapter-postgres/column-types';
import { cuid2, ksuid, nanoid, ulid, uuidv4, uuidv7 } from '@internal/ids';
import { defineContract, field, model, rel } from '@internal/postgres/contract-builder';

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

const Account = model('Account', {
  namespace: 'auth',
  fields: { id: field.id.cuid2(), userId: field.uuidString(), provider: field.column(textColumn) },
});

const Profile = model('Profile', {
  fields: { id: field.id.ksuid(), userId: field.uuidString(), rank: field.column(int4Column) },
});

export const contract = defineContract({
  namespaces: ['auth'],
  types: { TimestampString3: timestampString3, TimestamptzString3: timestamptzString3 },
  models: {
    User: User.relations({
      posts: rel.hasMany(Post, { by: 'authorId' }),
      accounts: rel.hasMany(Account, { by: 'userId' }),
      profile: rel.hasOne(Profile, { by: 'userId' }),
    }).sql({ table: 'users' }),
    Post: Post.relations({
      author: rel.belongsTo(User, { from: 'authorId', to: 'id' }),
      tags: rel.manyToMany(Tag, { through: PostTag, from: 'postId', to: 'tagId' }),
    }).sql({ table: 'posts' }),
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
      user: rel.belongsTo(User, { from: 'userId', to: 'id' }),
    }).sql({ table: 'profiles' }),
  },
});
