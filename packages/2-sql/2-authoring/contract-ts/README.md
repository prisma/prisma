# @prisma-next/sql-contract-ts

**Status:** Current SQL TypeScript contract authoring surface

This package owns the SQL TypeScript authoring API for Prisma Next.

## Package Classification

- **Domain**: sql
- **Layer**: authoring
- **Plane**: migration

## Overview

This package is part of the SQL family namespace (`packages/2-sql/2-authoring/contract-ts`) and provides:

- the SQL contract DSL centered on `defineContract(...)`
- the base structural helpers exported from `./contract-builder`: `field.column(...)`, `field.generated(...)`, `field.namedType(...)`, plus `model(...)` and `rel.*`
- an optional callback overload that exposes pack-composed helpers — namespaced helpers like `field.id.uuidv7String()`, `field.text()`, `field.temporal.createdAt()`, `field.temporal.updatedAt()`, plus pack-contributed entity-type helpers at top level alongside the built-in `model` / `rel` (e.g. `enum({ name, values })`)
- lowering from authored model definitions into the canonical SQL `Contract`

## Responsibilities

- **SQL contract authoring**: Build SQL contracts programmatically with type safety
- **Pack-composed helper vocabulary**: Merge family, target, and extension authoring contributions into the callback helper namespaces
- **Lowering pipeline**: Turn authored model definitions into the canonical SQL contract artifacts consumed by the rest of the stack
- **Config helper**: Provide `typescriptContract(...)` for `prisma-next.config.ts`
- **Schema validation**: Contract JSON validation flows through the per-target descriptor SPI (`descriptor.contractSerializer.deserializeContract(json)`)

## Package Status

This is the current SQL TypeScript authoring implementation. Shared descriptor types live in `@prisma-next/contract-authoring`. Contract validation flows through the per-target descriptor's `contractSerializer` SPI (e.g. `postgresTarget.contractSerializer.deserializeContract`), or via the canonical façade (`postgres<Contract>(...)`).

## Architecture

- **Base DSL**: `./contract-builder` exports the stable structural DSL (`defineContract`, `field`, `model`, `rel`)
- **Composed helper namespaces**: `defineContract(config, (helpers) => ...)` synthesizes `helpers.field.*` and `helpers.type.*` from the selected family, target, and extension packs
- **SQL resolution and contract generation**: internal resolution normalizes names, relations, indexes, and FK materialization before producing the canonical SQL contract artifacts
- **Shared descriptor layer**: `@prisma-next/contract-authoring` provides the target-neutral descriptor types used by the DSL and by authoring-adjacent packs

Contributor-facing lowering notes and detailed warning semantics live in [DEVELOPING.md](./DEVELOPING.md).

```mermaid
flowchart LR
  builderInput[TypeScript contract input] --> sqlContractTs[@prisma-next/sql-contract-ts]
  sqlContractTs --> authoringCore[@prisma-next/contract-authoring]
  sqlContractTs --> sqlTypes[@prisma-next/sql-contract/types]
  sqlContractTs --> contract[SQL Contract]
```

## Exports

- `./contract-builder` - SQL contract DSL (`defineContract`, `field`, `model`, `rel`)
- `./config-types` - `typescriptContract(...)` config helper

## Usage

### Direct Structural DSL

Direct imports expose the base structural helpers. Use this surface when you want to author with explicit column descriptors, explicit generators, or named storage types.

Built-in ID helpers from `@prisma-next/ids` already return the generated-field spec accepted by `field.generated(...)`, so `field.generated(uuidv4())` is a valid structural DSL call.

```typescript
import { textColumn, timestamptzColumn } from '@prisma-next/adapter-postgres/column-types';
import sqlFamily from '@prisma-next/family-sql/pack';
import { uuidv4 } from '@prisma-next/ids';
import { defineContract, field, model, rel } from '@prisma-next/sql-contract-ts/contract-builder';
import postgresPack from '@prisma-next/target-postgres/pack';

const User = model('User', {
  fields: {
    id: field.generated(uuidv4()).id(),
    email: field.column(textColumn).unique(),
    createdAt: field.column(timestamptzColumn).defaultSql('now()'),
  },
})
  .relations({
    posts: rel.hasMany('Post', { by: 'userId' }),
  })
  .sql({
    table: 'app_user',
  });

const Post = model('Post', {
  fields: {
    id: field.generated(uuidv4()).id(),
    userId: field.column(textColumn),
    title: field.column(textColumn),
  },
})
  .relations({
    user: rel.belongsTo(User, { from: 'userId', to: 'id' }),
  })
  .sql({
    table: 'blog_post',
  });

export const contract = defineContract({
  family: sqlFamily,
  target: postgresPack,
  naming: { tables: 'snake_case', columns: 'snake_case' },
  models: {
    User,
    Post,
  },
});
```

### Callback Helper Vocabulary

Pack-provided helper presets are available through the callback overload. This is the surface that exposes `field.id.*`, `field.text()`, `field.temporal.createdAt()`, `field.temporal.updatedAt()`, `type.sql.String(...)`, and extension helpers such as `type.pgvector.Vector(...)`.

```typescript
import pgvector from '@prisma-next/extension-pgvector/pack';
import sqlFamily from '@prisma-next/family-sql/pack';
import { defineContract, enumType, member } from '@prisma-next/sql-contract-ts/contract-builder';
import postgresPack from '@prisma-next/target-postgres/pack';

const pgText = { codecId: 'pg/text@1', nativeType: 'text' } as const;
const Role = enumType('role', pgText, member('USER', 'user'), member('ADMIN', 'admin'));

export const contract = defineContract(
  {
    family: sqlFamily,
    target: postgresPack,
    extensions: { pgvector },
  },
  ({ type, field, model, rel }) => {
    const types = {
      ShortName: type.sql.String(35),
      Embedding1536: type.pgvector.Vector(1536),
    } as const;

    const User = model('User', {
      fields: {
        id: field.id.uuidv7String().sql({ id: { name: 'user_pkey' } }),
        shortName: field.namedType(types.ShortName),
        role: field.namedType(Role),
        embedding: field.namedType(types.Embedding1536).optional(),
        createdAt: field.temporal.createdAt(),
        updatedAt: field.temporal.updatedAt(),
      },
    });

    const Post = model('Post', {
      fields: {
        id: field.id.uuidv7String(),
        authorId: field.uuidString(),
        title: field.text(),
      },
    });

    return {
      enums: { role: Role },
      types,
      models: {
        User: User.relations({
          posts: rel.hasMany(Post, { by: 'authorId' }),
        }).sql({
          table: 'user',
        }),
        Post: Post.relations({
          author: rel.belongsTo(User, { from: 'authorId', to: 'id' }),
        }).sql({
          table: 'post',
        }),
      },
    };
  },
);
```

### Constraint Placement

Single-field constraints are usually most readable inline on the field, while compound constraints live in `.attributes(...)` or model-level `.sql(...)`.

```typescript
const Membership = model('Membership', {
  fields: {
    orgId: field.column(textColumn).column('org_id'),
    userId: field.column(textColumn).column('user_id'),
    role: field.column(textColumn),
  },
})
  .attributes(({ fields, constraints }) => ({
    id: constraints.id([fields.orgId, fields.userId], { name: 'membership_pkey' }),
    uniques: [
      constraints.unique([fields.orgId, fields.role], {
        name: 'membership_org_role_key',
      }),
    ],
  }))
  .sql({ table: 'membership' });
```

### Indexes

`constraints.index` (inside model `.sql(...)` under `indexes: [...]`) has two forms:

```typescript
constraints.index([cols.email], { unique: true, where: '(archived_at IS NULL)', name: 'users_email_active' })
constraints.index({ expression: 'eql_v3.eq_term(email)', name: 'users_email_eq' })
```

- **Fields form** — `constraints.index(cols | [cols...], options?)`. Options: `unique?`, `where?` (partial-index predicate, WHERE body without the keyword), `name?` xor `map?`, and — when the target pack registers index types — `type?` paired with its `options?` (e.g. `type: 'hash', options: {}`). The pack-typed arm requires the `options` key at compile time; PSL accepts `type:` without `options:` (absent validates as `{}`) — both lower to the same IR.
- **Expression form** — `constraints.index({ expression, ...options })`. The expression is the whole CREATE INDEX element list as one opaque string; `name` or `map` is required (no default name can be derived from an expression). Same remaining options as the fields form.

`name:` declares a **managed** index: the physical name is `<name>_<8-hex content hash>`, and renames plan as `ALTER INDEX … RENAME`. `map:` adopts an **exact** physical name verbatim (no hash) — intended for objects captured by `contract infer`. Combining `map:` with a SQL body (`expression`/`where`) emits the `PN_EXACT_NAME_BODY_COMPARISON` warning at build time: drift detection byte-compares the authored text against Postgres's reprinted form, which is only reliable for infer-captured text. Prefer `name:` for hand-authored bodies.

### Helper Notes

- Structural helpers: `field.column(...)`, `field.generated(...)`, `field.namedType(...)`, plus `model(...)` and `rel.*`
- Callback helper presets: `field.id.uuidv4String()`, `field.id.uuidv7String()`, `field.id.nanoid({ size })`, `field.uuidString()`, `field.text()`, `field.timestamp()`, `field.temporal.createdAt()`, `field.temporal.updatedAt()`, and `type.*` (Postgres also adds `field.uuidNative()`, `field.id.uuidv4Native()`, `field.id.uuidv7Native()` — these emit `pg/uuid@1`)
- Timestamp helpers mirror PSL semantics: `field.temporal.createdAt()` lowers to a target storage `now()` default, while `field.temporal.updatedAt()` lowers to the target-owned `timestampNow` execution default for create and non-empty update mutations.
- Keep field-local and FK-local storage overrides next to the authoring site with `field.sql(...)` and `rel.belongsTo(...).sql({ fk })`
- Prefer typed local refs such as `field.namedType(types.Role)`, `User.refs.id`, and `User.ref('id')` when those tokens are available
- See [API.md](./API.md) for generated-field spec semantics, validation rules, and typed-reference warning behavior

### Foreign Key Defaults

Use the root-level `foreignKeyDefaults` option when a contract wants non-default FK materialization:

```typescript
const contract = defineContract({
  family: sqlFamily,
  target: postgresPack,
  foreignKeyDefaults: { constraint: true, index: false },
  models: {
    // ...
  },
});
```

Per-FK overrides still live next to the FK authoring site, either via `constraints.foreignKey(...)` inside model `.sql(...)` or via `rel.belongsTo(...).sql({ fk: ... })`. See [ADR 161](../../../../docs/architecture%20docs/adrs/ADR%20161%20-%20Explicit%20foreign%20key%20constraint%20and%20index%20configuration.md).

### Validating Contracts

Contract JSON validation flows through the per-target descriptor's
`contractSerializer` SPI; this package focuses on authoring and lowering.
End-user app code typically goes through the canonical façade
(`postgres<Contract>(...)`), which threads the descriptor SPI internally.

```typescript
import postgres from '@prisma-next/postgres/runtime';
import contractJson from './contract.json' with { type: 'json' };
import type { Contract, TypeMaps } from './contract.d';

const db = postgres<Contract, TypeMaps>({
  contractJson,
  url: process.env['DATABASE_URL']!,
});
```

For advanced consumers that need direct access to the SPI:

```typescript
import postgresTarget from '@prisma-next/target-postgres/control';
import type { Contract } from './contract.d';

const contract = postgresTarget.contractSerializer.deserializeContract(
  contractJson,
) as Contract;
```

### Config Helper

Use `typescriptContract` from this package when wiring TS-authored contracts in `prisma-next.config.ts`.

```typescript
import { defineConfig } from '@prisma-next/cli/config-types';
import { typescriptContract } from '@prisma-next/sql-contract-ts/config-types';
import { contract } from './src/prisma/contract';

export default defineConfig({
  contract: typescriptContract(contract, 'src/prisma/contract.json'),
});
```

Optional third argument (options bag) for `typescriptContract` / `typescriptContractFromPath`, and `defaultControlPolicy` on `emptyContract`:

```typescript
typescriptContract(contract, 'src/prisma/contract.json', { defaultControlPolicy: 'external' });
```

The specifier value applies only when the loaded contract omits `defaultControlPolicy` (a value authored on the contract module wins).

## Dependencies

- **`@prisma-next/config`** - `ContractConfig` types used by `typescriptContract(...)`
- **`@prisma-next/contract-authoring`** - Shared descriptor types
- **`@prisma-next/framework-components`** - Pack refs, authoring contributions, and codec lookup types
- **`@prisma-next/sql-contract`** - SQL contract types and validation target

## Testing

Unit tests for the authoring DSL live in this package. Broader integration tests that span authoring, emission, CLI, and runtime packages live in `@prisma-next/integration-tests`.

## Migration Notes

- Direct imports give you the structural DSL
- The callback overload gives you pack-composed helper vocabularies
- Import authoring helpers directly from `@prisma-next/sql-contract-ts`
- Reach contract validation through the per-target descriptor's `contractSerializer.deserializeContract(...)` (or via the canonical façade)

## See Also

- `@prisma-next/contract-authoring` - Shared target-neutral authoring descriptor types
- `@prisma-next/sql-contract-psl` - PSL parser-output to SQL contract interpreter
- `@prisma-next/sql-contract-psl/provider` - SQL PSL-first `prismaContract()` helper
