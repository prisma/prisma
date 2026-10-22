import {
  autoincrement,
  defineContract,
  enumType,
  member,
  rel,
} from '../../src/exports/contract-builder';

/** The example contract with a nullable `nickname` on `User`. */
export function contractWithNickname() {
  const Role = enumType(
    'Role',
    { codecId: 'mysql/enum@1' },
    member('USER', 'USER'),
    member('ADMIN', 'ADMIN'),
  );
  return defineContract({ enums: { Role } }, ({ field, model, type }) => {
    const User = model('User', {
      fields: {
        id: field.column(type.Int()).id().default(autoincrement()),
        email: field.column(type.String()).unique(),
        role: field.namedType(Role),
        nickname: field.column(type.String()).optional(),
      },
    });
    const Post = model('Post', {
      fields: {
        id: field.column(type.Int()).id().default(autoincrement()),
        title: field.column(type.String()),
        authorId: field.column(type.Int()),
      },
    });
    return {
      models: {
        User: User.relations({ posts: rel.hasMany(Post, { by: 'authorId' }) }),
        Post: Post.relations({ author: rel.belongsTo(User, { from: 'authorId', to: 'id' }) }).sql(
          ({ cols, constraints }) => ({
            foreignKeys: [constraints.foreignKey(cols.authorId, User.refs.id)],
          }),
        ),
      },
    };
  });
}
