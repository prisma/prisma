# Brief: D8 authoring docs and upgrade instructions — round 3

## Task

Resolve reviewer findings F4 and F5. Correct the pgvector operations test so its shared descriptor declares the actual two-dimensional vector length, and rewrite the stale earlier PostgreSQL examples in the canonical codec authoring guide so they teach the target-owned `PostgresCodecDescriptor`/`postgresCodec(...)` protocol rather than generic `CodecDescriptorImpl` or the obsolete `PgCharDescriptor extends SqlCharDescriptor` alias pattern. Keep the accepted new target-specific section and upgrade entry intact except for any link/example consistency needed by these corrections.

## Scope

**In:** `packages/3-extensions/pgvector/test/operations.test.ts` shared ref `length: 2`; stale PostgreSQL examples in `docs/reference/codec-authoring-guide.md`; focused pgvector tests; docs lint/link checks; isolated extension replay update and aggregate test; original D8 gates affected by the corrections.

**Out:** Changing pgvector production schemas/codecs; changing other refs already matching three-dimensional data; broad guide restructuring; new upgrade entries/scripts; JSON behavior/runtime changes; prototype/stash operations.

## Completed when

- [ ] The operations test uses `length: 2` for `[1, 2]`/`[3, 4]`, all other corrected refs match their actual vector dimensions, and focused pgvector tests pass after clean target artifacts.
- [ ] No canonical guide example teaches a PostgreSQL descriptor extending generic `CodecDescriptorImpl` or target alias inheritance from `SqlCharDescriptor`; examples use target descriptor subclassing or explicit `postgresCodec(...)` adaptation and remain consistent with the accepted dormant-projection guidance.
- [ ] Isolated replay applies the parameterized-ref instruction with the correct per-ref dimensions, matches the branch, and the aggregate extension test passes; docs/skills/upgrade/dependency/fixture/diff/scope gates remain green.
- [ ] Only F4/F5 correction files are explicitly staged in one signed-off commit with no amend/push/rebase/stash.

## Standing instruction

Dimensions describe the actual stored vector shape; do not normalize every fixture to `3`. The guide must teach one current protocol consistently from first example to last. Do not weaken validation or preserve obsolete patterns for compatibility.

## Operational metadata

- **Model tier:** persistent implementer/thorough — small diff, but replay and canonical documentation consistency remain load-bearing.
- **Time-box:** 45 minutes wall clock.
- **Halt conditions:** A corrected example requires an API not actually exported; another vector ref has ambiguous dimensionality; replay exposes a different deterministic failure; any production change or destructive Git/`git stash*` action.
- **Harness constraint:** Built-in search/grep/glob/find-path tools are forbidden. Use bounded terminal/bash `rg` and targeted `sed`/`cat` only.
