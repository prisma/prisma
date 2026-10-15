import { defineContract, rel } from '@prisma/orm-postgres/contract-builder';

export const plain = defineContract({}, ({ field, model }) => {
  const User = model('User', { fields: { id: field.id.uuidv4String(), email: field.text() } });
  const Post = model('Post', {
    fields: { id: field.id.uuidv4String(), userId: field.uuidString() },
  });
  return {
    models: {
      User: User.relations({ posts: rel.hasMany(Post, { by: 'userId' }) }).sql({ table: 'user' }),
      Post: Post.relations({ user: rel.belongsTo(User, { from: 'userId', to: 'id' }) }).sql({
        table: 'post',
      }),
    },
  };
});
