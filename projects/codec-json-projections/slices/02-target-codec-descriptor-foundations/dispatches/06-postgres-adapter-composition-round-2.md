# Brief: D6 PostgreSQL adapter composition — round 2

## Task

Resolve F3 by making direct PostgreSQL custom codec injection atomic. A caller must not be able to supply an extension-aware generic `codecLookup` while silently receiving the built-ins-only target registry, nor may runtime/control construction carry independently divergent generic and target registries. Preserve supported custom codec injection by accepting a coherent PostgreSQL target-descriptor contribution surface and deriving both ordinary codec materialization and target native-type rendering from that same validated descriptor set; update stale option documentation accordingly.

## Scope

**In:** Tests first for direct runtime and control custom descriptor injection; public/internal constructor option coherence; deriving generic lookup plus typed target registry from one descriptor set or validated bundle; early rejection of incomplete/mismatched custom inputs; stale `codecLookup` documentation; focused regression of D6 accepted behavior and gates.

**Out:** Reopening accepted stack composition, native-type SQL, factory receiver, or JSON pass-through design; generic framework/control-stack changes; compatibility shims for the independently injectable generic lookup if they preserve the split-brain state; JSON projection execution; SQLite; metadata removal; docs/upgrade work beyond the touched API documentation; prototype/stash operations.

## Completed when

- [ ] New direct runtime/control tests prove a valid custom `PostgresCodecDescriptor` contribution is visible to both generic codec materialization and native-type lowering from one coherent construction input.
- [ ] The public API cannot silently construct mismatched generic and target registries: the old partial override is removed at authoring time or rejected synchronously at construction, and stale documentation no longer claims a generic lookup alone controls renderer visibility.
- [ ] F3 is resolved without changing accepted D6 enum/custom/array/no-cast SQL, stack contribution ordering, bare built-ins-only behavior, dormant JSON hooks, metadata, contracts, or fixtures; focused target/adapter tests plus adapter typecheck/lint, dependency/cast/throw/fixture and diff/scope gates pass in a signed-off correction commit.

## Standing instruction

The target descriptor set is the source of truth. Do not infer target behavior from codec IDs or generic metadata, and do not add a compatibility fallback that allows the generic and target registries to diverge. Preserve the ability to inject custom PostgreSQL codecs through the new type-safe target descriptor protocol; this pre-1.0 slice may hard-cut an incoherent generic-only option rather than retain an unsafe public shape.

## Operational metadata

- **Model tier:** persistent implementer/thorough — public option coherence and direct runtime/control parity require careful type and behavior preservation.
- **Time-box:** 45 minutes wall clock.
- **Halt conditions:** Custom codec injection cannot remain supported without changing generic framework APIs; accepted D6 SQL/JSON behavior regresses; the correction requires codec-ID branching, query-time narrowing, metadata removal, or any destructive Git/`git stash*` action.
- **Harness constraint:** Built-in search/grep/glob/find-path tools are forbidden. Use bounded terminal/bash `rg` and targeted `sed`/`cat` only.
