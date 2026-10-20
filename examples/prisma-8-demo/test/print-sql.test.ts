import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  delete process.env['DATABASE_URL'];
});

import { db } from '../src/prisma/db';

describe('the demo client with no database', () => {
  it('renders the SQL of a custom collection method', () => {
    const plan = db.orm.public.User.admins().select('id', 'email').prepared.all().plan;

    expect(db.toSql(plan)).toEqual({
      sql: 'SELECT "user"."id" AS "id", "user"."email" AS "email" FROM "public"."user" WHERE "user"."kind" = $1',
      params: ['admin'],
    });
  });
});
