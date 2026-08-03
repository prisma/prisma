import { datetimeColumn, textColumn } from '@prisma/orm-sqlite/adapter/column-types';
import { defineContract, rel } from '@prisma/orm-sqlite/contract-builder';

export const contract = defineContract({}, ({ field, model }) => {
  const User = model('User', {
    fields: {
      id: field.id.uuidv4String(),
      email: field.column(textColumn),
      displayName: field.column(textColumn),
      createdAt: field.column(datetimeColumn).defaultSql('now()'),
    },
  });

  const Post = model('Post', {
    fields: {
      id: field.id.uuidv4String(),
      title: field.column(textColumn),
      userId: field.uuidString(),
      createdAt: field.column(datetimeColumn).defaultSql('now()'),
    },
  });

  const Tag = model('Tag', {
    fields: {
      id: field.id.uuidv4String(),
      label: field.column(textColumn),
    },
  });

  const PostTag = model('PostTag', {
    fields: {
      postId: field.uuidString(),
      tagId: field.uuidString(),
    },
  }).attributes(({ fields, constraints }) => ({
    id: constraints.id([fields.postId, fields.tagId], { name: 'post_tag_pkey' }),
  }));

  return {
    models: {
      User: User.relations({
        posts: rel.hasMany(Post, { by: 'userId' }),
      }).sql({
        table: 'user',
      }),
      Post: Post.relations({
        user: rel.belongsTo(User, { from: 'userId', to: 'id' }),
        tags: rel.manyToMany(() => Tag, {
          through: () => PostTag,
          from: 'postId',
          to: 'tagId',
        }),
      }).sql(({ cols, constraints }) => ({
        table: 'post',
        foreignKeys: [
          constraints.foreignKey(cols.userId, User.refs.id, {
            name: 'post_userId_fkey',
          }),
        ],
      })),
      Tag: Tag.relations({
        posts: rel.manyToMany(() => Post, {
          through: () => PostTag,
          from: 'tagId',
          to: 'postId',
        }),
      }).sql({
        table: 'tag',
      }),
      PostTag: PostTag.sql(({ cols, constraints }) => ({
        table: 'post_tag',
        foreignKeys: [
          constraints.foreignKey(cols.postId, Post.refs.id, { name: 'post_tag_postId_fkey' }),
          constraints.foreignKey(cols.tagId, Tag.refs.id, { name: 'post_tag_tagId_fkey' }),
        ],
      })),
    },
  };
});
