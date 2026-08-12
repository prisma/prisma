// Integration coverage for M:N relation filters via junction EXISTS.
//
// `User.tags` is a many-to-many relation to `Tag` through the `user_tags`
// junction table. `.some`/`.none`/`.every` on M:N relations emit correlated
// EXISTS/NOT EXISTS subqueries against the junction. These tests prove
// end-to-end correctness against a real database.
//
// Test data shape:
//
//   User(id, name, email, invitedById?, address?)
//     tags: N:M Tag through user_tags (via user_id / tag_id)
//
//   Tag(id: text, name: text)
//
//   UserTag(userId, tagId) — junction
//
// Standard:
//   1. Whole-row toEqual assertions on the exact filtered user set.
//   2. Explicit .select() used in most tests.
//   3. At least one test uses implicit/default selection (no .select()).

import { and } from '@internal/sql-orm-client';
import { describe, expect, it } from 'vitest';
import { createUsersCollection, timeouts, withCollectionRuntime } from './integration-helpers';
import { seedTags, seedUsers, seedUserTags } from './runtime-helpers';

const TAG_RUST = 'tag-rust';
const TAG_TS = 'tag-typescript';
const TAG_DB = 'tag-database';

describe('integration/mn-filter', () => {
  // ===========================================================================
  // some — users having ≥1 tag matching the predicate.
  // ===========================================================================

  it(
    'some: returns only users that have at least one matching tag (explicit select, whole-row toEqual)',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);

        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
          { id: 3, name: 'Cara', email: 'cara@example.com' },
        ]);
        await seedTags(runtime, [
          { id: TAG_RUST, name: 'Rust' },
          { id: TAG_TS, name: 'TypeScript' },
        ]);
        // Alice: Rust + TypeScript, Bob: TypeScript only, Cara: no tags.
        await seedUserTags(runtime, [
          { userId: 1, tagId: TAG_RUST },
          { userId: 1, tagId: TAG_TS },
          { userId: 2, tagId: TAG_TS },
        ]);

        const rows = await users
          .select('id', 'name')
          .where((u) => u.tags.some((t) => t.name.eq('Rust')))
          .orderBy((u) => u.id.asc())
          .all();

        // Only Alice has Rust.
        expect(rows).toEqual([{ id: 1, name: 'Alice' }]);
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'some: multiple users each having the matching tag are all returned (explicit select)',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);

        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
          { id: 3, name: 'Cara', email: 'cara@example.com' },
        ]);
        await seedTags(runtime, [
          { id: TAG_TS, name: 'TypeScript' },
          { id: TAG_DB, name: 'Database' },
        ]);
        // Alice and Bob both have TypeScript; Cara only has Database.
        await seedUserTags(runtime, [
          { userId: 1, tagId: TAG_TS },
          { userId: 2, tagId: TAG_TS },
          { userId: 3, tagId: TAG_DB },
        ]);

        const rows = await users
          .select('id', 'name')
          .where((u) => u.tags.some((t) => t.name.eq('TypeScript')))
          .orderBy((u) => u.id.asc())
          .all();

        expect(rows).toEqual([
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ]);
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'some: composes with a scalar where predicate (explicit select, whole-row toEqual)',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);

        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Alice', email: 'alice.without-rust@example.com' },
          { id: 3, name: 'Bob', email: 'bob@example.com' },
        ]);
        await seedTags(runtime, [
          { id: TAG_RUST, name: 'Rust' },
          { id: TAG_TS, name: 'TypeScript' },
        ]);
        await seedUserTags(runtime, [
          { userId: 1, tagId: TAG_RUST },
          { userId: 2, tagId: TAG_TS },
          { userId: 3, tagId: TAG_RUST },
        ]);

        const rows = await users
          .select('id', 'name', 'email')
          .where((u) =>
            and(
              u.name.eq('Alice'),
              u.tags.some((t) => t.name.eq('Rust')),
            ),
          )
          .orderBy((u) => u.id.asc())
          .all();

        expect(rows).toEqual([{ id: 1, name: 'Alice', email: 'alice@example.com' }]);
      });
    },
    timeouts.spinUpPpgDev,
  );

  // ===========================================================================
  // none — users with no tag matching the predicate.
  // ===========================================================================

  it(
    'none: returns only users with no tag matching the predicate (explicit select, whole-row toEqual)',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);

        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
          { id: 3, name: 'Cara', email: 'cara@example.com' },
        ]);
        await seedTags(runtime, [
          { id: TAG_RUST, name: 'Rust' },
          { id: TAG_TS, name: 'TypeScript' },
        ]);
        // Alice: Rust only, Bob: TypeScript only, Cara: no tags.
        await seedUserTags(runtime, [
          { userId: 1, tagId: TAG_RUST },
          { userId: 2, tagId: TAG_TS },
        ]);

        const rows = await users
          .select('id', 'name')
          .where((u) => u.tags.none((t) => t.name.eq('Rust')))
          .orderBy((u) => u.id.asc())
          .all();

        // Bob has no Rust tag; Cara has no tags at all (also satisfies none).
        expect(rows).toEqual([
          { id: 2, name: 'Bob' },
          { id: 3, name: 'Cara' },
        ]);
      });
    },
    timeouts.spinUpPpgDev,
  );

  // ===========================================================================
  // every — users all of whose tags match the predicate, including vacuous
  // case (user with no tags satisfies every) and exclusion of partial match.
  // ===========================================================================

  it(
    'every: returns users whose tags all match the predicate, excludes partial match (explicit select)',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);

        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
          { id: 3, name: 'Cara', email: 'cara@example.com' },
        ]);
        await seedTags(runtime, [
          { id: TAG_RUST, name: 'Rust' },
          { id: TAG_TS, name: 'TypeScript' },
        ]);
        // Alice: Rust only — all her tags are Rust → qualifies.
        // Bob: Rust + TypeScript — not all tags are Rust → excluded.
        // Cara: no tags — vacuously true → qualifies.
        await seedUserTags(runtime, [
          { userId: 1, tagId: TAG_RUST },
          { userId: 2, tagId: TAG_RUST },
          { userId: 2, tagId: TAG_TS },
        ]);

        const rows = await users
          .select('id', 'name')
          .where((u) => u.tags.every((t) => t.name.eq('Rust')))
          .orderBy((u) => u.id.asc())
          .all();

        // Alice: qualifies (only Rust). Cara: qualifies (vacuous). Bob: excluded.
        expect(rows).toEqual([
          { id: 1, name: 'Alice' },
          { id: 3, name: 'Cara' },
        ]);
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'every: vacuous case — user with no tags satisfies every (explicit select, isolated)',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);

        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
        ]);
        await seedTags(runtime, [{ id: TAG_TS, name: 'TypeScript' }]);
        // Alice has TypeScript; Bob has no tags.
        await seedUserTags(runtime, [{ userId: 1, tagId: TAG_TS }]);

        const rows = await users
          .select('id', 'name')
          .where((u) => u.tags.every((t) => t.name.eq('Rust')))
          .orderBy((u) => u.id.asc())
          .all();

        // Alice has TypeScript which is NOT Rust → excluded.
        // Bob has no tags → vacuously satisfies every → included.
        expect(rows).toEqual([{ id: 2, name: 'Bob' }]);
      });
    },
    timeouts.spinUpPpgDev,
  );

  // ===========================================================================
  // Implicit/default selection (standard requirement: ≥1 test without .select).
  // ===========================================================================

  it(
    'some: no .select returns full default user row shape (implicit selection)',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);

        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
        ]);
        await seedTags(runtime, [{ id: TAG_DB, name: 'Database' }]);
        // Only Alice has Database.
        await seedUserTags(runtime, [{ userId: 1, tagId: TAG_DB }]);

        const rows = await users
          .where((u) => u.tags.some((t) => t.name.eq('Database')))
          .orderBy((u) => u.id.asc())
          .all();

        // Full User row shape for Alice only.
        expect(rows).toEqual([
          {
            id: 1,
            name: 'Alice',
            email: 'alice@example.com',
            invitedById: null,
            address: null,
          },
        ]);
      });
    },
    timeouts.spinUpPpgDev,
  );

  // ===========================================================================
  // Empty-match edge — predicate that no tag satisfies.
  // ===========================================================================

  it(
    'some with no matching tag returns empty result set (explicit select)',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);

        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
        ]);
        await seedTags(runtime, [
          { id: TAG_RUST, name: 'Rust' },
          { id: TAG_TS, name: 'TypeScript' },
        ]);
        await seedUserTags(runtime, [
          { userId: 1, tagId: TAG_RUST },
          { userId: 2, tagId: TAG_TS },
        ]);

        // 'Go' tag does not exist at all — some returns no users.
        const rows = await users
          .select('id', 'name')
          .where((u) => u.tags.some((t) => t.name.eq('Go')))
          .all();

        expect(rows).toEqual([]);
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'none with no matching tag (all users pass) returns all users (explicit select)',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);

        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
        ]);
        await seedTags(runtime, [
          { id: TAG_RUST, name: 'Rust' },
          { id: TAG_TS, name: 'TypeScript' },
        ]);
        // Neither user has a 'Go' tag.
        await seedUserTags(runtime, [
          { userId: 1, tagId: TAG_RUST },
          { userId: 2, tagId: TAG_TS },
        ]);

        // 'Go' matches nothing → none(Go) is satisfied by every user.
        const rows = await users
          .select('id', 'name')
          .where((u) => u.tags.none((t) => t.name.eq('Go')))
          .orderBy((u) => u.id.asc())
          .all();

        expect(rows).toEqual([
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ]);
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'every with predicate that no tag satisfies excludes all tagged users (explicit select)',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);

        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
        ]);
        await seedTags(runtime, [
          { id: TAG_RUST, name: 'Rust' },
          { id: TAG_TS, name: 'TypeScript' },
        ]);
        await seedUserTags(runtime, [
          { userId: 1, tagId: TAG_RUST },
          { userId: 2, tagId: TAG_TS },
        ]);

        // every(name='Go') lowers to NOT EXISTS(… AND NOT(name='Go')).
        // Alice's Rust tag fails the predicate → NOT(pred) is true → EXISTS fires → excluded.
        // Bob's TypeScript tag fails the predicate → same → excluded.
        const rows = await users
          .select('id', 'name')
          .where((u) => u.tags.every((t) => t.name.eq('Go')))
          .orderBy((u) => u.id.asc())
          .all();

        expect(rows).toEqual([]);
      });
    },
    timeouts.spinUpPpgDev,
  );
});
