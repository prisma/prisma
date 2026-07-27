# Brief: D8 authoring docs and upgrade instructions

## Task

Document the public PostgreSQL and SQLite target codec descriptor authoring model delivered by D1–D7, and add a semantically complete extension-author upgrade entry for the in-flight `0.16-to-0.17` transition. The documentation must teach target and extension authors how to subclass target descriptors, adapt generic SQL descriptors, define target-typed descriptor tuples, contribute descriptors through runtime/control stacks, and use coherent direct adapter injection. It must accurately state that scalar projection hooks are explicit but remain dormant in production JSON rendering during this behavior-preserving slice; it must not claim canonical lossless JSON or the future numeric/bytea/BLOB formats. The upgrade entry must describe the concrete actions required to migrate PostgreSQL-bound extensions and be validated by execution in an isolated worktree against the pre-TML-3061 extension substrate.

## Scope

**In:** Public target/adapter authoring docs at the narrowest existing canonical package or reference surfaces; PostgreSQL/SQLite descriptor subclass and generic adapter examples; `definePostgresCodecs(...)` / `defineSqliteCodecs(...)`; mandatory native/scalar hooks and PostgreSQL default array lift semantics; stable structural validation/open-world target ownership; coherent `codecDescriptors` direct injection; transitional metadata coexistence and dormant renderer hooks; extension-author `skills/extension-author/prisma-next-extension-upgrade/upgrades/0.16-to-0.17/instructions.md` entry with unique ID, detection, exact migration actions, dependency/import guidance, and no no-op prose; colocated deterministic script only if justified; isolated replay and extension test validation; documentation/skill/dependency/upgrade coverage gates.

**Out:** User-facing `skills/upgrade/prisma-next-upgrade` entry unless an actual `examples/` substrate diff is discovered; claims that JSON projection formats are canonical or active; changing codec JSON/SQL/runtime behavior; adding production dependencies for a test harness; generic target maps; metadata removal; TML-3063 migration guidance; unrelated package docs rewrites; prototype/stash operations.

## Completed when

- [ ] Public docs accurately show target-specific descriptor authoring, generic descriptor adaptation, target-typed arrays, stack contribution, coherent direct injection, structural validation, and current projection-hook dormancy for both PostgreSQL and SQLite, with links from the appropriate discoverable package/reference surfaces.
- [ ] `skills/extension-author/prisma-next-extension-upgrade/upgrades/0.16-to-0.17/instructions.md` contains a unique actionable entry covering the D5 extension migration: target descriptor base/adapters, explicit current native/projection hooks, tuple helpers, lean target package dependency/imports, and preservation of extension codec/factory/column/JSON behavior. It contains no narrative for changes requiring no consumer action.
- [ ] In an isolated worktree, restore `packages/3-extensions/` to the pre-TML-3061 stacked-base state, apply the entry exactly as a downstream extension author would, verify the resulting actionable substrate state matches this branch’s migrated extension state under the skill’s validation contract, and run `pnpm test --filter='./packages/3-extensions/*'` without network-dependent instructions or production test-harness dependencies. Any mismatch between the skill’s exact-replay contract and non-actionable repo-only test additions must be surfaced and resolved honestly rather than hidden.
- [ ] `pnpm check:upgrade-coverage --mode pr`, `pnpm lint:skills`, documentation link/lint gates available for touched surfaces, extension tests/typechecks/lints, `pnpm lint:deps`, `pnpm fixtures:check`, and `git diff --check` pass; bounded `rg` scans find no user-skill entry without an examples diff, active-lossless-JSON claim, generated drift, project-path leak, or out-of-scope implementation change. Only D8 files are explicitly staged in one signed-off commit with no amend/push.

## Standing instruction

Follow the `record-upgrade-instructions` skill exactly. The transition directory’s prior existence is not proof this PR is covered; add and semantically review this PR’s own `changes[]` entry. Prefer prose-driven migration when extension-specific class/factory shapes require judgment; add a script only when the transformation is deterministic and portable. Do not ship an integration-test harness as a production dependency. The PR description must later name `skills/extension-author/prisma-next-extension-upgrade/upgrades/0.16-to-0.17/` explicitly.

## References

- Slice spec: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/spec.md` §§ Public target descriptor protocols, Generic codec adaptation, Validated registries, Behavior-preserving transition.
- Slice plan: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/plan.md` § Dispatch 8.
- PostgreSQL protocol/composition: D1 commits `5f0bf523522b4da998b3a9efcc52662596ef4ca8`, `0eb83c8fac26426a04425ba26e3d9d37d28c77c3`; D6 commits `6f387bb06555ea70fd77310bccebd09f9324ef38`, `9740f0f7e6a363c3ce5ea6dbccf784d77330e5fa`.
- SQLite protocol/composition: D2 commit `03322328234c8c269c54edb1bec1fc4bc114ec95`; D7 commit `61a91627a42c41cd2d5a6a7008143966b30c8b45`.
- Extension substrate: D5 commit `942adde31c680e4617c1b173ce85f4b3bcdc24c1`; pre-slice stacked-base commit `4557df26d9514ecb5afe8d9de4abe207df8c186b`.
- Required workflow: `.agents/skills/record-upgrade-instructions/SKILL.md`; Markdown source uses no artificial line wrapping.
- Harness constraint: built-in search/grep/glob/find-path tools are forbidden. Use bounded terminal/bash `rg` and targeted `sed`/`cat` only.

## Operational metadata

- **Model tier:** persistent implementer/thorough — public SPI teaching, semantic upgrade authoring, and isolated replay require cross-surface judgment.
- **Time-box:** 90 minutes wall clock. Context/tool ceilings return a precise handoff without partial descope.
- **Halt conditions:** Current public APIs cannot be documented without exposing an inconsistency; replay requires network/secrets or a production test-harness dependency; the entry cannot reproduce the actionable extension migration under the skill’s contract; examples have an unexpected actionable diff requiring a second audience entry; generated fixture/contract drift appears; unrelated gate red; any destructive Git or `git stash*` action. Preserve the repository-global prototype stash.
