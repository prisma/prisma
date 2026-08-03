/**
 * Database Seed Script
 *
 * Populates the demo database with sample data using Prisma Next's SQL builder.
 *
 * Run with: pnpm seed
 *
 * Prerequisites:
 * - SQLITE_PATH env var (defaults to ./demo.db)
 * - Database schema applied (run `pnpm emit` then `pnpm db:init`)
 */
import 'dotenv/config';

import { loadAppConfig } from '../src/app-config';
import { db } from '../src/prisma/db';

async function main() {
  const { databasePath } = loadAppConfig();
  const runtime = await db.connect({ path: databasePath });

  try {
    await runtime.execute(
      db.sql.user
        .insert([
          {
            email: 'alice@example.com',
            displayName: 'Alice',
            createdAt: new Date(),
          },
        ])
        .build(),
    );

    await runtime.execute(
      db.sql.user
        .insert([
          {
            email: 'bob@example.com',
            displayName: 'Bob',
            createdAt: new Date(),
          },
        ])
        .build(),
    );

    const aliceRows = await runtime.execute(
      db.sql.user
        .select('id', 'email')
        .where((f, fns) => fns.eq(f.email, 'alice@example.com'))
        .limit(1)
        .build(),
    );
    const alice = aliceRows[0] ?? null;

    const bobRows = await runtime.execute(
      db.sql.user
        .select('id', 'email')
        .where((f, fns) => fns.eq(f.email, 'bob@example.com'))
        .limit(1)
        .build(),
    );
    const bob = bobRows[0] ?? null;

    if (!alice || !bob) {
      throw new Error('Failed to create users');
    }

    console.log(`Created user: ${alice.email} (id: ${alice.id})`);
    console.log(`Created user: ${bob.email} (id: ${bob.id})`);

    const firstPostRows = await runtime.execute(
      db.sql.post
        .insert([{ title: 'First Post', userId: alice.id, createdAt: new Date() }])
        .returning('id', 'title')
        .build(),
    );
    const secondPostRows = await runtime.execute(
      db.sql.post
        .insert([{ title: 'Second Post', userId: alice.id, createdAt: new Date() }])
        .returning('id', 'title')
        .build(),
    );
    await runtime.execute(
      db.sql.post.insert([{ title: 'Third Post', userId: bob.id, createdAt: new Date() }]).build(),
    );

    const firstPost = firstPostRows[0] ?? null;
    const secondPost = secondPostRows[0] ?? null;
    if (!firstPost || !secondPost) {
      throw new Error('Failed to create posts');
    }

    console.log(`Created post: ${firstPost.title} (id: ${firstPost.id})`);
    console.log(`Created post: ${secondPost.title} (id: ${secondPost.id})`);

    const tagTypeScriptRows = await runtime.execute(
      db.sql.tag
        .insert([{ label: 'typescript' }])
        .returning('id', 'label')
        .build(),
    );
    const tagOrmRows = await runtime.execute(
      db.sql.tag
        .insert([{ label: 'orm' }])
        .returning('id', 'label')
        .build(),
    );
    const tagDemoRows = await runtime.execute(
      db.sql.tag
        .insert([{ label: 'demo' }])
        .returning('id', 'label')
        .build(),
    );

    const tagTypeScript = tagTypeScriptRows[0] ?? null;
    const tagOrm = tagOrmRows[0] ?? null;
    const tagDemo = tagDemoRows[0] ?? null;
    if (!tagTypeScript || !tagOrm || !tagDemo) {
      throw new Error('Failed to create tags');
    }

    console.log(`Created tag: ${tagTypeScript.label} (id: ${tagTypeScript.id})`);
    console.log(`Created tag: ${tagOrm.label} (id: ${tagOrm.id})`);
    console.log(`Created tag: ${tagDemo.label} (id: ${tagDemo.id})`);

    await runtime.execute(
      db.sql.post_tag
        .insert([
          { postId: firstPost.id, tagId: tagTypeScript.id },
          { postId: firstPost.id, tagId: tagOrm.id },
          { postId: secondPost.id, tagId: tagOrm.id },
          { postId: secondPost.id, tagId: tagDemo.id },
        ])
        .build(),
    );

    console.log('Seeded post_tag junction rows.');
    console.log('Seed completed successfully!');
  } finally {
    await runtime.close();
  }
}

main().catch((e) => {
  console.error('Error seeding database:', e);
  process.exitCode = 1;
});
