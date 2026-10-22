# Project plan — MySQL proof of concept

**Spec:** [`spec.md`](./spec.md) · **Design notes:** [`design-notes.md`](./design-notes.md) · **Coupling register:** [`coupling.md`](./coupling.md) · **Linear:** [MySQL proof of concept](https://linear.app/prisma-company/project/mysql-proof-of-concept-da2bc4144a89)

## At a glance

| Slice | What it delivers | Builds on | Linear | State |
| --- | --- | --- | --- | --- |
| 1 | Every target in one folder per database; `2-sql` becomes `2-sql-family` | — | [TML-3693](https://linear.app/prisma-company/issue/TML-3693) | Not started |
| 2 | MySQL target: contract, migrations, `db verify`, `db sign` | 1 | [TML-3694](https://linear.app/prisma-company/issue/TML-3694) | Not started |
| 3 | MySQL ORM reads with includes | 2 | [TML-3695](https://linear.app/prisma-company/issue/TML-3695) | Not started |
| 4 | ORM writes without `RETURNING`; MySQL create, update, delete, upsert | 3 | [TML-3696](https://linear.app/prisma-company/issue/TML-3696) | Not started |
| 5 | `mariadb` target extending MySQL | 4 | [TML-3697](https://linear.app/prisma-company/issue/TML-3697) | Not started |

```text
1 → 2 → 3 → 4 → 5 → close-out
```

- Each slice is one pull request against `main`.
- Five slices is one more than the usual limit. Slice 1 is a pure move with no MySQL code, kept apart so its diff is reviewable as renames and the MySQL slices only add files.
- The slices are a stack because each tests against the previous one: reads need tables that slice 2 creates, writes read rows back through slice 3's reads, and MariaDB subclasses the finished MySQL target.

## Slices

### 1 — Every target in one folder per database

- Postgres, SQLite and Mongo move into `packages/3-targets/<db>/{1-target,2-adapter,3-driver,4-codec-testkit,9-facade}`. `2-sql` becomes `2-sql-family`.
- Every target registers in `architecture.config.json` the same way, and gets the layering test.
- Docs rewritten; a new ADR records the layout.

**Hands to 2:** the folder a new target goes in, and the registration recipe it follows.

### 2 — MySQL target: contract, migrations, verify, sign

- Target, adapter, driver and facade in `packages/3-targets/mysql/`.
- The spec's contract emits, plans, migrates, verifies and signs against MySQL 8.4.
- Migration atomicity becomes a target fact; MySQL resumes per space.
- A MySQL server in CI, pending Will's approval (spec, open question 1).

**Hands to 3:** a MySQL database the tests can create and migrate, and the MySQL runtime adapter to add lowering to.

### 3 — MySQL ORM reads with includes

- Select, filter, order, limit and includes lower to MySQL SQL, with golden tests and tests against MySQL 8.4.
- How related rows keep their order is decided against a live server.

**Hands to 4:** the read path the ORM's read-back uses after a write.

### 4 — ORM writes without `RETURNING`

- Writes find the written rows' identity without `RETURNING` and read them back.
- The `returning` capability splits by statement; the SQL driver reports the last insert id.
- Upsert's conflict model admits a target that cannot name the conflict.

**Hands to 5:** a complete MySQL target to subclass.

### 5 — MariaDB

- `packages/3-targets/mariadb/` subclasses MySQL and overrides JSON, defaults, relation loading and upsert rendering.
- Every MySQL test passes against MariaDB 10.11.

**Hands to close-out:** both targets proven, and the coupling register complete.

## Close-out (required)

- [ ] Verify every condition in the spec's Project DoD.
- [ ] Every entry in `coupling.md` is fixed or filed as a Linear issue; every breaking one is fixed.
- [ ] File the follow-up issues for full MySQL and MariaDB support.
- [ ] Migrate long-lived decisions into ADRs (layout; migration atomicity; MariaDB as an extending target; writes without `RETURNING`).
- [ ] Mark stream 1 row 3 done on the GA planning branch.
- [ ] Strip repo-wide references to `projects/mysql-poc/**`.
- [ ] Delete `projects/mysql-poc/`.
