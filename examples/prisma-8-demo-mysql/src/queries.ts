import type { Db } from './prisma/db';

/** Up to `limit` admins, ordered by email. */
export function getAdmins(db: Db, limit: number) {
  return db.orm.User.where({ role: 'ADMIN' })
    .orderBy((u) => u.email.asc())
    .limit(limit)
    .all();
}

/** A user with their posts, newest title first: the posts come back in the order the include asks for. */
export function getUserWithPosts(db: Db, id: number) {
  return db.orm.User.include('posts', (posts) => posts.orderBy((p) => p.title.desc())).first({
    id,
  });
}

/** Every post with its author. */
export function getPostsWithAuthors(db: Db) {
  return db.orm.Post.include('author')
    .orderBy((p) => p.id.asc())
    .all();
}

/** Every user's emails and post titles, each post with its author's email: an include two levels deep. */
export function getUsersWithPostAuthors(db: Db) {
  return db.orm.User.select('email')
    .include('posts', (posts) =>
      posts
        .select('title')
        .orderBy((p) => p.id.asc())
        .include('author', (author) => author.select('email')),
    )
    .orderBy((u) => u.id.asc())
    .all();
}

/** Admin ids and emails through the SQL builder. */
export function getAdminEmails(db: Db) {
  return db.query(
    db.sql.User.select('id', 'email')
      .where((f, fns) => fns.eq(f.role, 'ADMIN'))
      .orderBy('id')
      .build(),
  );
}
