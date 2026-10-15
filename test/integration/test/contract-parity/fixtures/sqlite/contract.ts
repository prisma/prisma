/**
 * The field presets, id generators and relation shapes the planner golden fixture leaves out, so the parity test compares them with their emitted types.
 */

import { integerColumn, textColumn } from '@internal/adapter-sqlite/column-types';
import { cuid2, ksuid, nanoid, ulid, uuidv4, uuidv7 } from '@internal/ids';
import { defineContract } from '@internal/sqlite/contract-builder';

// The foreign key defaults turn backing indexes off, so only a foreign key that asks for one gets it.
export const contract = defineContract(
  { foreignKeyDefaults: { constraint: true, index: false } },
  ({ field, model, rel }) => {
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
        seenAt: field.temporal.datetime(),
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

    const Profile = model('Profile', {
      fields: {
        id: field.id.ksuid(),
        userId: field.uuidString(),
        rank: field.column(integerColumn),
      },
    });

    return {
      models: {
        User: User.relations({
          posts: rel.hasMany(Post, { by: 'authorId' }),
          profile: rel.hasOne(Profile, { by: 'userId' }),
        }).sql(({ cols, constraints }) => ({
          table: 'users',
          indexes: [
            constraints.index([cols.email]),
            constraints.index([cols.ulid], { map: 'users_ulid_exact' }),
            constraints.index([cols.nanoid, cols.cuid2], { name: 'by_short_ids', unique: true }),
          ],
        })),
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
        Profile: Profile.relations({
          user: rel.belongsTo(User, { from: 'userId', to: 'id' }).sql({ fk: { index: true } }),
        }).sql({ table: 'profiles' }),
      },
    };
  },
);
