import { defineContract, rel } from '@prisma/orm-postgres/contract-builder';

export const contract = defineContract({}, ({ field, model }) => {
  const User = model('User', {
    fields: {
      id: field.id.uuidv4String(),
      email: field.text(),
      createdAt: field.temporal.createdAt(),
      updatedAt: field.temporal.updatedAt(),
    },
  });

  const Post = model('Post', {
    fields: {
      id: field.id.uuidv4String(),
      title: field.text(),
      userId: field.uuidString(),
      createdAt: field.temporal.createdAt(),
      updatedAt: field.temporal.updatedAt(),
    },
  });

  return {
    models: {
      User: User.relations({
        posts: rel.hasMany(Post, { by: 'userId' }),
      }).sql({
        table: 'user',
      }),
      Post: Post.relations({
        user: rel.belongsTo(User, { from: 'userId', to: 'id' }),
      }).sql(({ cols, constraints }) => ({
        table: 'post',
        foreignKeys: [
          constraints.foreignKey(cols.userId, User.refs.id, {
            name: 'post_userId_fkey',
          }),
        ],
      })),
    },
  };
});
