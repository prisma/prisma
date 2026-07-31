# Prisma Next Demo

This example demonstrates **Prisma Next in its native form**, using the Prisma Next APIs directly without the compatibility layer.

## Purpose

This demo shows:
- Using Prisma Next's query lanes (SQL DSL, Raw SQL, etc.)
- Creating Plans and executing them via the Runtime
- Contract verification and marker management
- Native Prisma Next patterns and best practices
- ORM client end-to-end examples using `@internal/sql-orm-client`
- **Two workflows**: Emit workflow (JSON-based) and No-Emit workflow (TypeScript-based)
- Client-generated UUID identifiers via `@internal/ids`

## Comparison

- **`prisma-next-demo`** (this example): Shows Prisma Next native APIs
- **`prisma-orm-demo`**: Shows using Prisma Next via the compatibility layer (mimics Prisma 7 API)

## Workflows

This demo includes two runtime implementations demonstrating different approaches:

### 1. Emit Workflow (Default)

Uses emitted `contract.json` and `contract.d.ts` files with the Postgres one-liner client. The emitted workflow passes the `Contract` type explicitly: `postgres<Contract>({ contractJson, url })`.

- **Files**: `src/prisma/db.ts`, `src/main.ts`
- **Contract source**: `src/prisma/contract.json` (emitted from `src/prisma/contract.prisma`)
- **Usage**: `pnpm start -- [command]`
- **Benefits**:
  - Contract is validated and normalized at emit time
  - JSON can be loaded from external sources
  - Type definitions are separate from runtime code

**Setup**:

```bash
pnpm emit
pnpm db:init   # Creates schema + contract marker
pnpm seed
pnpm start -- users
```

#### Dual-mode emit validation (TS vs PSL)

This repo maintains two emit configs:

- **PSL emit (default)**: `prisma-next.config.ts`
- **TypeScript emit**: `prisma-next.config.ts-contract.ts`

To prove the demo test suite passes in both modes:

```bash
pnpm test:dual-mode
```

### 2. No-Emit Workflow

Uses contract directly from TypeScript:

- **Files**: `src/prisma-no-emit/runtime.ts`, `src/prisma-no-emit/context.ts`, `src/main-no-emit.ts`
- **Contract source**: `prisma/contract.ts` (direct import)
- **Usage**: `pnpm start:no-emit -- [command]`
- **Benefits**:
  - No emit step required - contract is used directly
  - Full type safety from TypeScript
  - Simpler workflow for development

**Usage**:

```bash
# No emit step needed - just run the app
pnpm start:no-emit -- users
```

## Architecture

```mermaid
flowchart LR
  Contract[Contract artifacts] --> Db[postgres(...)]
  Db --> Static[Static roots]
  Db --> Lazy[runtime()]
  Lazy --> Runtime[Runtime]
```

Contract artifacts are `contract.json` and `contract.d.ts`. Static roots are `sql`, `schema`, `orm`, `context`, and `stack`.

## Related Docs

- **[Query Lanes](../../docs/architecture%20docs/subsystems/3.%20Query%20Lanes.md)** — DSL and ORM authoring surfaces
- **[Runtime & Middleware Framework](../../docs/architecture%20docs/subsystems/4.%20Runtime%20&%20Middleware%20Framework.md)** — Runtime execution pipeline
- **[ADR 164 - Repository Layer](../../docs/architecture%20docs/adrs/ADR%20164%20-%20Repository%20Layer.md)** — Multi-query repository orchestration layer

## ORM Client Examples

The demo includes ORM client examples under `src/orm-client/`:

- `ormClientGetUsers(limit, runtime)` — list users using ORM client API
- `ormClientGetAdminUsers(limit, runtime)` — filter through a custom collection scope
- `ormClientFindUserByEmail(email, runtime)` — `first()` with collection helpers
- `ormClientGetUserPosts(userId, limit, runtime)` — fetch user posts with collection filters + ordering
- `ormClientGetDashboardUsers(emailDomain, postTitleTerm, limit, postsPerUser, runtime)` — compound `and/or/not` filters + relation filters + `select()` and `include()` composition
- `ormClientGetPostFeed(postTitleTerm, limit, runtime)` — to-one include (`post -> user`) with projected fields
- `ormClientGetUserTaskBoard(limit, runtime)` — **polymorphic-target include**: `User.include('tasks')` where `Task` is a discriminated base; each included row is decoded into its variant shape (`Bug` → `severity`/`stepsToRepro`, `Feature` → `priority`/`targetRelease`) in a single read
- `ormClientGetUserBugTriage(severity, limit, runtime)` — `.variant('Bug')`-narrowed include filtered by the Bug-only `severity` column
- `ormClientGetFeatureRoadmap(targetRelease, limit, runtime)` — `.variant('Feature')`-narrowed include filtered by the Feature-only `targetRelease` column (a multi-table-inheritance variant column reached through the variant join)
- `ormClientGetPostTags(postId, runtime)` — **many-to-many include**: `Post.include('tags', …)` traversing the `post_tag` junction transparently
- `ormClientGetTagPosts(tagId, runtime)` — the same junction walked from the other side (`Tag.include('posts', …)`)
- `ormClientGetPostsByTagFilter(mode, label, runtime)` — `some`/`none`/`every` relation filter predicates on the N:M `tags` relation (EXISTS through the junction)
- `ormClientConnectPostTags(postId, tagIds, runtime)` — `update({ tags: (t) => t.connect([…]) })` inserting junction rows
- `ormClientDisconnectPostTags(postId, tagIds, runtime)` — `update({ tags: (t) => t.disconnect([…]) })` deleting junction rows
- `ormClientCreatePostWithTags(input, runtime)` — nested `create`: insert a post + new tags + junction rows in one mutation
- `ormClientCreatePostConnectTags(input, runtime)` — nested `connect` in the create flow: insert a post and link existing tags
- `ormClientGetUsersByIdCursor(cursor, limit, runtime)` — cursor pagination with `orderBy()` + `cursor()`
- `ormClientGetLatestUserPerKind(runtime)` — `distinctOn()` with deterministic ordering
- `ormClientGetUserInsights(limit, runtime)` — `include().combine()` metrics and latest related row
- `ormClientGetUserKindBreakdown(minUsers, runtime)` — `groupBy().having().aggregate()` breakdown
- `ormClientUpsertUser(data, runtime)` — `upsert()` for create-or-update by primary key
- `ormClientFindUserByIdCached(id, runtime, options?)` — opt-in cached `first({ id })` lookup via `cacheAnnotation({ ttl })` from `@internal/middleware-cache`
- `ormClientGetUsersCached(limit, runtime, options?)` — opt-in cached `User.all()` listing, with optional explicit cache-key override

Run from the CLI:

```bash
pnpm start -- repo-users 5
pnpm start -- repo-admins 5
pnpm start -- repo-user admin@example.com
pnpm start -- repo-posts user_001 10
pnpm start -- repo-dashboard example.com post 10 2
pnpm start -- repo-post-feed post 10
pnpm start -- repo-task-board 10
pnpm start -- repo-bug-triage critical 10
pnpm start -- repo-feature-roadmap v2.0 10
pnpm start -- repo-users-cursor user_001 5
pnpm start -- repo-latest-per-kind
pnpm start -- repo-user-insights 5
pnpm start -- repo-kind-breakdown 1
pnpm start -- repo-upsert-user 00000000-0000-0000-0000-000000000099 demo@example.com user
# Many-to-many (post and tag ids are printed by the seed)
pnpm start -- repo-post-tags <postId>
pnpm start -- repo-tag-posts <tagId>
pnpm start -- repo-posts-with-tag-some typescript
pnpm start -- repo-posts-with-tag-none typescript
pnpm start -- repo-posts-with-tag-every typescript
pnpm start -- repo-connect-post-tags <postId> <tagId>
pnpm start -- repo-disconnect-post-tags <postId> <tagId>
pnpm start -- repo-create-post-with-tags <newPostId> <userId> 'Title' label1 label2
pnpm start -- repo-create-post-connect-tags <newPostId> <userId> 'Title' <tagId>
```

## Polymorphic Includes

The `Task` model is a discriminated base (`@@discriminator(type)`) with two
variants stored in their own tables: `Bug` (`severity`, `stepsToRepro`) and
`Feature` (`priority`, `targetRelease`). `User.tasks` points at that base, so
including it is a **polymorphic-target include** — the read joins the variant
tables and decodes each row into the shape its discriminator selects.

The task-board include takes the **default projection** (no `select(...)`), so
each included row comes back in its full default shape: the shared `Task`
columns plus the columns of whichever variant the discriminator selects:

```bash
pnpm start -- repo-task-board 10
```

```jsonc
[
  {
    "id": "…", "displayName": "Alice", "kind": "admin",
    "tasks": [
      // Bug rows carry the shared Task columns + the Bug columns…
      { "id": "…", "title": "Login crashes on Safari", "description": null,
        "status": "open", "type": "bug", "userId": "…",
        "createdAt": "2024-03-01T00:00:00+00:00", "severity": "critical",
        "stepsToRepro": "Open Safari → click \"Sign in\" → blank white screen" },
      // …Feature rows carry the shared Task columns + the Feature columns,
      // all from one query.
      { "id": "…", "title": "Dark mode", "description": null,
        "status": "open", "type": "feature", "userId": "…",
        "createdAt": "2024-03-02T00:00:00+00:00", "priority": "P1",
        "targetRelease": "v2.0" }
    ]
  }
]
```

`.variant(...)` narrows the include to a single variant so the refinement's
`where` can filter on that variant's own columns — even when, as with
`Feature`, those columns live in a separate table reached through the variant
join:

```bash
# Only critical bugs, per user.
pnpm start -- repo-bug-triage critical 10

# Only features targeting a release, per user.
pnpm start -- repo-feature-roadmap v2.0 10
```

The source files: `src/orm-client/get-user-task-board.ts`,
`get-user-bug-triage.ts`, and `get-feature-roadmap.ts`.

## Many-to-Many Examples

The PSL source authors a `Post ↔ Tag` many-to-many as an explicit junction
model: `PostTag` carries a composite `@@id` over its two FK columns plus the
two N:1 `@relation`s, and both side models declare bare list fields
(`Post.tags`, `Tag.posts`). The interpreter lowers that shape to navigable
`N:M` relations, so the ORM client traverses the junction transparently:

```bash
# Include in both directions (ids are printed by the seed).
pnpm start -- repo-post-tags <postId>
pnpm start -- repo-tag-posts <tagId>

# some/none/every relation filters — EXISTS through the junction.
pnpm start -- repo-posts-with-tag-some typescript
pnpm start -- repo-posts-with-tag-none typescript
pnpm start -- repo-posts-with-tag-every typescript

# Nested writes via the callback mutator: junction INSERT / DELETE,
# and create flows that insert targets + links in one mutation.
pnpm start -- repo-connect-post-tags <postId> <tagId>
pnpm start -- repo-disconnect-post-tags <postId> <tagId>
pnpm start -- repo-create-post-with-tags <newPostId> <userId> 'Title' label1 label2
pnpm start -- repo-create-post-connect-tags <newPostId> <userId> 'Title' <tagId>
```

The M:N relation API shown here is available because `PostTag` is a *pure*
junction (its only columns are the two foreign keys). When a junction carries
a required non-FK payload column, the relation sugar cannot populate it, so
nested `create`/`connect` on that relation are disabled at the type level
(their inputs become `never`) and rejected at runtime; populate such junctions
through the junction model's own relations or the SQL builder instead. There
is deliberately no runnable example of that guard — the type-level gate makes
it uncompilable.

The source files: `src/orm-client/get-post-tags.ts`, `get-tag-posts.ts`,
`get-posts-by-tag-filter.ts`, `connect-post-tags.ts`, `disconnect-post-tags.ts`,
`create-post-with-tags.ts`, and `create-post-connect-tags.ts`.

## Cache Middleware Examples

The demo wires `@internal/middleware-cache` into the Postgres client in `src/prisma/db.ts`. The cache middleware is **opt-in per query** — it only acts on plans whose `meta.annotations` carry a `cacheAnnotation` payload with a `ttl` set. Three CLI commands run a query twice and report the latency of each call so the cache hit is visible:

```bash
# ORM client first({ id }) cached for 60s.
pnpm start -- cache-demo-user 00000000-0000-0000-0000-000000000001

# ORM client User.all() listing cached for 60s.
pnpm start -- cache-demo-users 5

# SQL DSL .annotate(cacheAnnotation({ ttl })) on a select.
pnpm start -- cache-demo-sql 5
```

A representative run looks like:

```text
Demonstrating opt-in caching with cacheAnnotation...
Calling User.first({ id: 00000000-... }) twice — second call should hit cache.

First call (cache miss):  4.71ms
Second call (cache hit):  0.18ms
Speedup: 26.2x faster
```

The corresponding source files:

- `src/orm-client/find-user-by-id-cached.ts` — `db.User.first({ id }, (meta) => meta.annotate(cacheAnnotation({ ttl })))`
- `src/orm-client/get-users-cached.ts` — `db.User.take(n).all((meta) => meta.annotate(cacheAnnotation({ ttl, key? })))`
- `src/queries/get-users-cached.ts` — `db.sql.public.user.select(...).annotate(cacheAnnotation({ ttl })).build()`

Relevant points:

- The `cacheAnnotation` handle declares `applicableTo: ['read']`. Passing it to a write terminal is rejected at both the type and runtime levels — a `as any` cast cannot smuggle it past one without failing at the other.
- The default cache key is `RuntimeMiddlewareContext.contentHash(exec)`, a SHA-512 digest of the post-lowering SQL plus parameters. Different parameters land in different cache slots; identical executions hit. Schema migrations rotate `meta.storageHash`, which feeds into `contentHash`, so cached entries do not leak across migrations.
- The default in-memory store is per-process. For shared caching across replicas, supply a custom `CacheStore` (for example a Redis-backed implementation) via `createCacheMiddleware({ store })`.
- Connection-scoped (`runtime.connection().execute(...)`) and transaction-scoped (`runtime.transaction(...)`) executions bypass the cache regardless of annotation, so transactional read-after-write coherence is preserved.

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set up your database connection:
   - Create a `.env` file
   - Add your PostgreSQL connection string: `DATABASE_URL=postgresql://user:pass@localhost:5432/prisma_next_demo?schema=public`
   - **Note**: This demo uses the pgvector extension. Ensure pgvector is installed in your PostgreSQL database:
     ```sql
     CREATE EXTENSION IF NOT EXISTS vector;
     ```
     The seed script will create the extension automatically if it doesn't exist.

3. Emit contract and initialize database:
   ```bash
   pnpm emit
   pnpm db:init
   ```

4. Seed the database:
   ```bash
   pnpm seed
   ```

5. Run tests:
   ```bash
   pnpm test
   ```

## Browser Visualization

Run `pnpm dev` for the Vite app that visualizes the contract. It renders directly from the constructed Contract (the descriptor's `contractSerializer.deserializeContract` output) using React, with HMR when contract.json is re-emitted. See `src/app/`.

## Key Files

- `src/prisma/contract.prisma` - Prisma schema (source of truth for emitted workflow)
- `prisma/contract.ts` - TypeScript contract (used by no-emit workflow)
- `src/prisma/contract.json` - Emitted contract (emit workflow only)
- `src/prisma/contract.d.ts` - Emitted types (emit workflow only)
- `src/prisma/db.ts` - One-liner Postgres client + query roots (emit workflow)
- `src/prisma-no-emit/context.ts` - Env-free execution stack/context + query roots (no-emit workflow)
- `src/prisma-no-emit/runtime.ts` - Runtime factory (no-emit workflow)
- `src/orm-client/client.ts` - ORM client + custom collection scopes
- `src/orm-client/*.ts` - End-to-end ORM client query examples
- `src/main.ts` - App entrypoint with arktype config validation (emit workflow)
- `src/main-no-emit.ts` - App entrypoint with arktype config validation (no-emit workflow)
- `src/app/` - React browser visualization (validates contract, renders from constructed Contract)
- `scripts/stamp-marker.ts` - Contract marker management
- `scripts/seed.ts` - Database seeding (includes vector embeddings)
- `src/queries/similarity-search.ts` - Example vector similarity search query
- `test/` - Integration tests demonstrating Prisma Next usage

## Features Demonstrated

- **Vector Similarity Search**: The demo includes a `similarity-search.ts` query that demonstrates cosine distance operations using the pgvector extension pack.
- **Extension Packs**: Shows how to configure and use extension packs (pgvector) in `prisma-next.config.ts`.
