/**
 * The field presets, id generators, parameterized codecs and relation shapes the planner golden fixture leaves out, so the parity test compares them with their emitted types.
 */

import { int4Column, textColumn } from '@internal/adapter-postgres/column-types';
import { arktypeJson } from '@internal/extension-arktype-json/column-types';
import arktypeJsonPack from '@internal/extension-arktype-json/pack';
import { cuid2, ksuid, nanoid, ulid, uuidv4, uuidv7 } from '@internal/ids';
import {
  defineContract,
  enumType,
  field,
  fullTextIndex,
  member,
  model,
  rel,
  sql,
} from '@internal/postgres/contract-builder';
import { type } from 'arktype';

const TimestampString3 = field.column({
  codecId: 'pg/timestamp-string@1',
  typeParams: { precision: 3 },
} as const);
const TimestamptzString3 = field.column({
  codecId: 'pg/timestamptz-string@1',
  typeParams: { precision: 3 },
} as const);

const Plan = enumType(
  'Plan',
  { codecId: 'pg/text@1' } as const,
  member('Free', 'free'),
  member('Paid', 'paid'),
);

const Ratio = enumType(
  'Ratio',
  { codecId: 'pg/numeric@1' } as const,
  member('Half', '0.5'),
  member('Whole', '1.50'),
);

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
    timestampStringAlias: TimestampString3,
    timestamptzStringAlias: TimestamptzString3.optional(),
    seenAt: field.temporal.timestamptzJsDate(3),
    handle: field.column(pgVarchar20),
    plan: field.namedType(Plan),
    ratio: field.namedType(Ratio),
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

// Foreign keys whose backing indexes the build names, cuts or leaves out.
const LongNamed = model('LongNamed', {
  fields: {
    id: field.id.uuidv4String(),
    organizationReference: field.uuidString().column('organization_reference_identifier'),
  },
}).sql(({ cols, constraints }) => ({
  table: 'organization_membership_invitations',
  foreignKeys: [constraints.foreignKey(cols.organizationReference, User.refs.id)],
}));

const PartialIndexed = model('PartialIndexed', {
  fields: { id: field.id.uuidv4String(), writerId: field.uuidString().column('writer_id') },
}).sql(({ cols, constraints }) => ({
  table: 'partial_writers',
  indexes: [
    constraints.index([cols.writerId], { name: 'set_writers', where: sql`writer_id IS NOT NULL` }),
  ],
  foreignKeys: [constraints.foreignKey(cols.writerId, User.refs.id)],
}));

const PlainIndexed = model('PlainIndexed', {
  fields: { id: field.id.uuidv4String(), writerId: field.uuidString().column('writer_id') },
}).sql(({ cols, constraints }) => ({
  table: 'plain_writers',
  indexes: [constraints.index([cols.writerId], { name: 'by_writer' })],
  foreignKeys: [constraints.foreignKey(cols.writerId, User.refs.id)],
}));

const KeyCovered = model('KeyCovered', {
  fields: {
    id: field.id.uuidv4String(),
    writerId: field.uuidString().column('writer_id').unique(),
  },
}).sql(({ cols, constraints }) => ({
  table: 'key_writers',
  foreignKeys: [constraints.foreignKey(cols.writerId, User.refs.id)],
}));

const Unindexed = model('Unindexed', {
  fields: { id: field.id.uuidv4String(), writerId: field.uuidString().column('writer_id') },
}).sql(({ cols, constraints }) => ({
  table: 'unindexed_writers',
  foreignKeys: [constraints.foreignKey(cols.writerId, User.refs.id, { index: false })],
}));

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
  enums: { Plan, Ratio },
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
    LongNamed,
    PartialIndexed,
    PlainIndexed,
    KeyCovered,
    Unindexed,
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
