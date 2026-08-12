# Dispatch plan — cutover-delete-native-enums (TML-2853)

Slice spec: [`./spec.md`](./spec.md). Three sequential dispatches: the atomic
repoint+retire, the machinery deletion with its two judgment sites, then the
straggler migration + the one-time fixture regeneration + the real upgrade entry.
Branch `tml-2853-…` from the tml-2885 tip (rebases onto main when #809's squash
lands — the established drill). Implementer: sonnet-mid; reviewer: opus.

### Dispatch 1: repoint `enum`, retire `enum2`

- **Outcome:** PSL `enum` parses via the generic extension-block grammar with the
  sql-family descriptor (keyword + factory key + diagnostics respelled
  `enum2`→`enum`); the dedicated native parse, `processEnumDeclarations`, the
  `PslEnum`/`PslEnumValue` AST, `namespace.enums`, and the printer's `serializeEnum`
  are deleted; every existing enum2 test asserts the same behavior under the `enum`
  spelling; the demo/cloudflare schemas still author `enum2`… **no** — schemas flip
  to `enum` here too where they used `enum2` (Priority), while native-enum schemas
  (`user_type`) are MIGRATED IN D3 — to keep D1 green, the demo's `user_type` block
  is temporarily converted in this dispatch as part of the respelling (its migration
  + artifact regeneration stays in D3; only the schema text + emitted artifacts move
  together — if that forces D3's migration work forward, halt and the orchestrator
  re-cuts the D1/D3 boundary).
- **Builds on:** the merged stack (the live lowering).
- **Hands to:** one keyword meaning the domain concept; compile-green tree with
  native *machinery* still present but unreachable from PSL.
- **Focus:** psl-parser, contract-psl interpreter, the sql-family descriptor +
  factory, psl-printer, framework psl-ast types, test respelling. **Out:** the
  machinery deletion (D2), migrations/fixtures (D3).

### Dispatch 2: delete the native machinery

- **Outcome:** spec component 2's inventory is gone; component 3's inference
  diagnostic exists with tests; component 4's pinned default investigated and
  implemented (legacy-replay surface for committed ops, or evidence-backed full
  delete); the `data-transform-enum-rebuild` e2e converted or deleted with rationale;
  cast ratchet decreases.
- **Builds on:** D1 (nothing authors native enums anymore).
- **Hands to:** a tree where only committed history knows native enums existed.
- **Focus:** postgres target + adapter packages, the contract IR entry/guard, the
  serializer hydration, the e2e journey. Halts: component 3/4 defaults not holding.

### Dispatch 3: migrate stragglers + regenerate once + upgrade entry

- **Outcome:** the demo's `user_type` migration (alter to text + check + type drop)
  applies on the existing chain and the demo suite passes incl. historic replay;
  cloudflare-worker example migrated; cli-e2e fixtures converted; canonical fixtures
  regenerated exactly once; the REAL 0.13→0.14 upgrade `changes[]` entry authored and
  validated by execution per the record-upgrade-instructions skill; slice-wide sweep
  green (full typecheck, test:packages, integration/e2e, fixtures:check, lint:deps,
  ratchet).
- **Builds on:** D1 + D2.
- **Hands to:** the slice-DoD — the project's end state on the SQL track.
- **Focus:** examples, test/integration fixtures + journeys, fixtures corpus,
  skills/upgrade. Stage only named files; verify staged stats (standing guardrail).
