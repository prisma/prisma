# `migration graph` — condensed annotated-tree rendering

This document is the rendering contract for the human-readable `migration graph`
output: how it draws the offline migration graph as a condensed annotated tree, the
row/grid model, the glyph palette (Unicode and ASCII), routed back-arcs, and its
relationship to the other migration views. It is reference material for anyone
maintaining or extending the tree renderer.

## Problem framing

`migration graph` (default human output) renders a **condensed annotated tree** in
the spirit of `git log --graph`, with **one contract node row per hash** and **one
migration row per edge**, both carrying the same `dirName` and `from → to` data
column as the flat list. The gutter is a multi-lane box-drawing spine (forward
branches, merge joins, and routed rollback arcs).

`--json` and `--dot` are machine-readable alternatives: JSON exports the graph
structure; DOT feeds GraphViz for a node-graph layout. The human tree renderer
does not use dagre or `graph-render.ts`.

## The model

1. **One contract = one node row** — `○ <hash>` (Unicode) or `* <hash>` (ASCII), with
   optional `(refs)` / `db` / `contract` overlays on the same line as the hash.
2. **One migration = one edge row** — gutter lane(s) + `dirName` + `from → to` (always
   forward `→` in the data column; edge *kind* is shown in the gutter arrow, not by
   reversing the data column).
3. **Vertical order** — tip at the top, roots at the bottom; within each weakly
   connected component, DFS post-order with `dirName`-descending neighbour order (same
   tie-break as `migration-list-graph-topology`). Disjoint components are separated by a blank
   row.
4. **Detached contract** — when the workspace contract hash does not appear in the
   graph, a floating node row is emitted above the main component (with `(contract)`
   overlay when applicable).

Topology classification (forward / rollback / self) and convergence/divergence
facts come from `migration-tools` via `classifyMigrationGraphTopology` on
`MigrationGraph`; row order and grid placement live in
`migration-graph-rows.ts` + `migration-graph-layout.ts`; glyph rendering lives in
`migration-graph-tree-render.ts`.

## Gutter spine

### In-lane direction glyphs

Each migration row occupies a **lane column** in the gutter. The lane cell for the
migration’s own column shows a vertical bar plus a direction glyph:

| Kind | Unicode | ASCII | Meaning |
|---|---|---|---|
| forward | `↑` | `^` | normal forward migration along the spine |
| rollback | `↓` | `v` | back-edge (target is an ancestor of the source) |
| self | `⟲` | `@` | `from == to` |

Pass-through lanes on the same row show only the vertical bar (`│` / `|`).

### Branch and merge connectors

When several forward branches diverge from one contract or converge into one, dedicated
**connector rows** (no `dirName`) draw the fan or join:

- **Branch below a divergence** — `├─` tee, co-sourced `┬─`, corner `╮` (Unicode); `+-`,
  `+-`, `\ ` (ASCII).
- **Merge above a convergence** — `├─` / `┴─` tees, corner `╯` (Unicode); `+-`, `/ `
  (ASCII).

### Routed back-arcs (skip-rollback)

When a rollback skips intermediate nodes, the layout routes a **back-arc** in extra
lanes instead of a single adjacent `↓`:

- **Source tee** — node row with `○─` / `*-` (arc tee) marking where the arc leaves.
- **Back-lane** — `│↓` / `|v` on the rollback row in a dedicated lane; `──` / `--`
  horizontal bridges and `┼─` / `+-` crossings where arcs cross the forward spine.
- **Landing** — node row with `○◂` / `*<` (arc land) plus `╯` / `/ ` corner, or
  `◂╯` / `*</` composite on one row when the landing shares cells with the spine.
- **Co-sourced arcs** — `┬─` / `+-` when two back-arcs share a branch point.
- **Converging arcs** — when two or more back-arcs land on the *same* node, the inner
  lanes read as a landing tee `┴─` / `+-` (the outer arcs' bridges pass through to the
  node) and only the outermost lane closes the corner `╯` / `/ `.

Adjacent rollbacks (target is the node directly below on the spine) stay a plain `↓` /
`v` in the primary lane — no arc routing.

## Data column and overlays

Every edge row ends with:

```
<dirName>  <from> → <to>
```

- **Hashes** — 7-character abbreviated contract hashes (`abbreviateContractHash`).
- **Empty baseline** — `∅` (Unicode) or `-` (ASCII) for `EMPTY_CONTRACT_HASH`, via
  `migrationListEmptySource`.
- **Forward arrow** — `→` (Unicode) or `->` (ASCII), via `migrationListForwardArrow`.
  Rollback rows still show `from → to`; the gutter
  `↓`/`v` carries the kind signal.
- **Self-edge** — both hashes are shown (`from → to` with identical abbreviations).

Node rows show the contract hash in the label column. Overlays (same decoration rules
as `migration list`):

- **`(refs)`** — ref names from `refsByHash`, sorted lexicographically.
- **`db`** — when the node hash matches the database marker hash.
- **`contract`** — when the node hash matches the workspace contract hash (and is not
  the empty baseline).

## Glyph palette

Lanes are **two visible columns** per grid cell (glyph + padding space), so every
structural role has a fixed width. Color (`MigrationListStyler`) is orthogonal to
glyph mode: `--no-color` disables ANSI styling; `--ascii` swaps glyphs only.

### Complete Unicode ↔ ASCII table

| Role | Unicode | ASCII |
|---|---|---|
| contract node | `○ ` | `* ` |
| arc source (tee on node) | `○─` | `*-` |
| arc landing (on node) | `○◂` | `*<` |
| vertical pass | `│ ` | `| ` |
| forward in-lane arrow | `↑` | `^` |
| rollback in-lane arrow | `↓` | `v` |
| self in-lane arrow | `⟲` | `@` |
| branch / merge tee | `├─` | `+-` |
| branch corner | `╮ ` | `\ ` |
| merge corner | `╯ ` | `/ ` |
| arc branch corner | `╮ ` | `\ ` |
| arc branch tee (co-source) | `┬─` | `+-` |
| arc land corner | `╯ ` | `/ ` |
| arc crossing | `┼─` | `+-` |
| horizontal / arc land bridge | `──` | `--` |
| connector co-branch tee | `┬─` | `+-` |
| connector co-merge tee | `┴─` | `+-` |
| data column arrow | `→` | `->` |
| empty baseline source | `∅` | `-` |

Implementation: `UNICODE_PALETTE` / `ASCII_PALETTE` in
`migration-graph-tree-render.ts`; shared list data-column symbols come from
`migration-list-data-column.ts`.

### ASCII fallback

Default glyph mode is **Unicode** when `glyphMode` is omitted (tests and internal
callers). The CLI resolves mode through `TerminalUI.resolveGlyphMode`:

- **`--ascii`** forces ASCII (pipe-friendly, CI snapshots).
- Otherwise **`detectGlyphMode({ isTTY, env })`** — ASCII when stdout is not a TTY or
  the locale is not UTF-8; Unicode on a UTF-8 TTY.

`--ascii` and `--no-color` are orthogonal: ASCII mode may still color hashes and refs
when color is enabled.

## Legend (`--legend`)

`--legend` prints a compact key for the tree's visual language — the contract-node marker, the in-lane direction arrows (`↑` / `↓` / `⟲`), the empty baseline (`∅`), the data-column arrow (`→`), the system markers and user-defined refs (`<contract, db>` for live markers; `(prod, staging)` for user-defined refs), and the rotating per-column lane colors. The lane-color row is shown only when color is enabled.

The flag is available on every command that draws the tree — `migration list`, `migration graph`, and `migration status` — and behaves identically across all three. The legend honors the active glyph palette (`--ascii` swaps to `* ^ v @ -`) and the same `colorize` gate as the renderer. It is decoration: it prints to **stderr** alongside the command header, so `migration list --legend | …` still pipes pure tree output on stdout. Combining `--legend` with `--json`, `--dot`, or `--quiet` is rejected (human-only).

Implementation: `renderMigrationGraphLegend` in `migration-graph-tree-render.ts`; the `shouldShowLegend` / `validateLegendOptions` helpers live in `utils/legend.ts`; lane hues come from `migration-graph-lane-colors.ts`.

## Relationship to the other views

| Command | Rows | Gutter |
|---|---|---|
| `migration list` | nodes + migrations (tree) | forward spine + routed back-arcs |
| `migration graph` (default) | nodes + migrations (tree) | forward spine + routed back-arcs |
| `migration graph --json` / `--dot` | structured / GraphViz | n/a (machine-readable) |

`migration list`, `migration status`, and `migration graph` share the same tree
renderer (`migration-graph-space-render.ts` → `migration-graph-tree-render.ts`).
`--json` and `--dot` bypass the tree pipeline entirely.

## Worked cases

Synthetic gallery tests in
`cli/test/utils/formatters/migration-graph-tree-render.test.ts` pin Unicode and ASCII
goldens for: linear chain, detached contract, ref/db/contract overlays, diamond,
three-way fan, skip-rollback with routed arcs, adjacent rollback, self-edge, and a
multi-topology composite.

Example (linear chain, Unicode):

```
○   a94b7b4
│↑  add_posts            ef9de27 → a94b7b4
○   ef9de27
│↑  init                 ∅ → ef9de27
○   ∅
```

The same fixture in ASCII (`--ascii` / `glyphMode: 'ascii'`):

```
*   a94b7b4
|^  add_posts            ef9de27 -> a94b7b4
*   ef9de27
|^  init                 - -> ef9de27
*   -
```

## Out of scope

- **Demo fixture loading** — golden tests use synthetic graphs only; fixture-backed
  snapshots are a separate follow-on.
- **Legacy dagre renderer** — `graph-render.ts`, `graph-migration-mapper.ts`, and
  `--dot` output are separate from the human tree pipeline; `--ascii` affects tree
  glyphs only.
