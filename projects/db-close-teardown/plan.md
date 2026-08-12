# Project Plan

## Summary

Two slices ship the design settled in [`./design-notes.md`](./design-notes.md):

1. **Facade `close()` + `[Symbol.asyncDispose]`** across postgres / sqlite / mongo, with the ownership rule applied (and mongo's existing `close()` corrected to honour it).
2. **Skill updates** to teach the script-shape teardown pattern and route the `db.end()` confabulation diagnostic.

Open at plan time: whether to co-ship the two slices in one PR (likely under ~400 lines reviewable in one sitting) or sequence them. Decided when slice 1 is sized.

**Spec:** [`./spec.md`](./spec.md)
**Design notes:** [`./design-notes.md`](./design-notes.md)

## Slices

### Slice 1 — Facade `close()` + asyncDispose

**Purpose.** Add `close()` and `[Symbol.asyncDispose]` to all three facade clients, applying the ownership rule. Correct mongo's existing `close()` to honour the rule.

**Scope.**

- `packages/3-extensions/postgres/src/runtime/postgres.ts` — interface members; ownership-tracking closure captured at pool construction; `close()` body (set `closed`, await `connectPromise.catch(...)`, invoke disposer).
- `packages/3-extensions/sqlite/src/runtime/sqlite.ts` — same shape, scoped to the SQLite handle.
- `packages/3-extensions/mongo/src/runtime/mongo.ts` — add `[Symbol.asyncDispose]`; refactor existing `close()` to track owned `MongoClient` (only when URL/uri+dbName binding was used) and skip driver-close when caller supplied `mongoClient`.
- Tests in each package:
  - Idempotence (`close()` × 2 = no throw).
  - In-flight connect during `close()` (postgres, sqlite — mongo has equivalent at `mongo.test.ts:392`).
  - Terminal state: post-close surface calls reject with `Error('<target> client is closed')`.
  - Ownership rule: caller-supplied pool / client still usable after `db.close()`.
  - Facade-owned resource: pool / mongo client / sqlite handle disposed after `db.close()`.
  - `await using db = …` exit-cleanly smoke (one per target).
- Release note line for the mongo behaviour change.

**Dependencies.** None on other slices in this project. Touches three workspace packages independently.

**Target Linear issue.** TML-2614 (this slice satisfies the framework-side acceptance criteria; skills slice is the remainder).

**Done when.** All ACs under "Surface", "Lifecycle correctness", "Terminal state", "Ownership rule", "Mongo behaviour change" in [`spec.md`](./spec.md) pass.

### Slice 2 — Skill updates

**Purpose.** Teach the new pattern in the user-facing skills so the next agent surfaces `db.close()` instead of hanging or confabulating `db.end()`.

**Scope.**

- `prisma-next-queries` — add "running this as a script" section showing `await db.close()` and `await using db`.
- `prisma-next-runtime` — teardown section + matcher keywords (`"script won't exit"`, `"hangs"`, `"close connection"`, `"db.end"`, `"db.close"`, `"pool.end"`, `[Symbol.asyncDispose]`, `await using`).
- `prisma-next-debug` — route `TypeError: db.end is not a function` to `prisma-next-runtime`'s teardown section.

(Skill files live under `skills-contrib/<skill-name>/SKILL.md` per AGENTS.md; per the skills convention, presentation symlinks at `.claude/skills/` and `.agents/skills/` are repopulated by the prepare hook on next install.)

**Dependencies.** Depends on Slice 1 landing first (or co-shipping with it) so the documented pattern actually works.

**Target Linear issue.** TML-2614 (same ticket; skill ACs).

**Done when.** All ACs under "Skills" in [`spec.md`](./spec.md) pass, plus a manual smoke that an onboarding-shape session driven by these skills lands on `db.close()` instead of `pool.end()` / hang.

### Decision: co-ship or sequence

Defaults to **co-ship** in one PR titled along the lines of `feat(facade): add db.close() + [Symbol.asyncDispose] to postgres/sqlite/mongo (TML-2614)`. Split into two PRs only if Slice 1's diff lands above ~400 lines of reviewable change, or if a reviewer reasonably asks to see the framework change merged before the skill changes.

## Close-out (required)

- [ ] Verify all acceptance criteria in [`./spec.md`](./spec.md)
- [ ] Migrate long-lived docs into `docs/` (none currently anticipated; design-notes deletes with the project)
- [ ] Strip repo-wide references to `projects/db-close-teardown/**` (replace with canonical `docs/` links or remove)
- [ ] Delete `projects/db-close-teardown/`
