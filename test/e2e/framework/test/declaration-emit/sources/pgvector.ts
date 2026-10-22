import { vector } from '@prisma/orm-extension-pgvector/column-types';
import pgvector from '@prisma/orm-extension-pgvector/pack';
import { defineContract, rel } from '@prisma/orm-postgres/contract-builder';

export const contract = defineContract({ extensions: { pgvector } }, ({ field, model, type }) => {
  const Embedding3 = field.column(type.pgvector.Vector(3));
  const User = model('User', {
    fields: {
      id: field.id.uuidv4String(),
      email: field.text(),
    },
  });
  const Post = model('Post', {
    fields: {
      id: field.id.uuidv4String(),
      title: field.text(),
      userId: field.uuidString(),
      embedding: Embedding3.optional(),
      raw: field.column(vector(4)).optional(),
    },
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
