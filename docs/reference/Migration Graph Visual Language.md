# Migration Graph Rendering — Visual Language

The locked visual vocabulary for the Tier-3 `migration graph` / `list` / `status`
renderer: the glyph alphabet, lane/column layout, and the worked picture for each
fixture topology. Companion to the [architecture](./12.%20Migration%20Graph%20Rendering.md);
this file is the glyph/layout contract, that file is the model behind it. The
pictures use real fixture hashes/names.

The core device: **a direction arrow in the edge's own
lane** (`↑` forward, `↓` rollback).

> **Color extension.** These mockups are
> drawn **monochrome** — every layout rule below must read unambiguously without
> color (rule 4 is explicit about this: the lane that owns the label carries the
> arrow, so a wide fan is unambiguous in monochrome). On top of that monochrome-
> correct base, the renderer now tints the **connective gutter** with a rotating
> color when color is enabled: **vertical lanes + branch/merge spine
> (`│ ├ ─ ╮ ┴ ┬`) by column index** (git `log --graph` style) — except the
> **leftmost lane (column 0) stays neutral/dim**, since the single-lane linear
> case has nothing to distinguish it from (the palette rotates over columns ≥ 1).
> A **routed back-arc is colored as one line** (a single hue, its owning back-lane
> color, across its vertical run + horizontal bridges + corners + `◂` landing) so
> it stays traceable instead of fragmenting into a per-column rainbow; crossings
> (`┼`) stay dim/neutral. The **contract node glyph `○` is colored by its lane**
> (the column it sits in, column-0-neutral), so each node belongs to its branch;
> the **direction arrows `↑ ↓ ⟲` stay bright** as the signal (they encode
> direction, not branch).
> Color is purely additive: it never changes which glyph is drawn or where, never
> alters visible width, and is dropped entirely under `--no-color` / non-TTY /
> piped output. An opt-in `--legend` flag prints a key for these glyphs and the
> lane-color cycle. Color is therefore a legibility aid, not part of the locked
> structural language — the monochrome reading remains the source of truth.

## The model

Contracts are **nodes**, migrations are **edges**. A migration is never a property
of a node; it is always the connector between two contracts.

## Layout rules (variant B + lane arrows)

1. **Root(s) at the bottom, tip(s) at the top.** Forward edges point **up** (`↑`),
   rollbacks point **down** (`↓`).
2. **A contract is one `○ <hash>` row**, appearing exactly once in the whole graph.
   Refs, the DB marker, and the current contract **decorate that row** — they are not
   glyph swaps on the `○`. See rule 10 + § node overlays.
3. **A migration is one edge row** — every migration on its own row (vertical space
   is cheap, horizontal is not).
4. **The arrow sits in the migration's own lane**, in the lane's second cell:
   `│↑` / `│↓`. Every other (pass-through) lane on that row is a bare `│ `. The
   arrow therefore does double duty:
   - **direction** — `↑` forward, `↓` rollback (no separate arc lane needed);
   - **lane** — in a fan, only the lane that owns the label carries the arrow, so
     the three `│ │ │` rows of a wide fan are unambiguous in monochrome.
5. **Convergence** (a contract with N parents) stacks N edge rows directly below it,
   each carrying its `↑` in its own lane down to its parent. A long edge is a lane
   that runs several rows before reaching its node — still one continuous lane.
6. **Divergence** (a contract with N children) fans N lanes upward; each outgoing
   edge is labelled in its own lane.
7. **Adjacency, not direction, decides whether an edge is drawn.** An edge whose
   target is its layout-neighbour is **just a direction glyph** — `↑` to the node
   directly above, `↓` to the node directly below. This is symmetric: a simple
   rollback (and every 2-node cycle) is a plain `↓`, exactly mirroring forward `↑`.
   No connector, no arc.
8. **Only a *node-skipping* edge gets a routed connector** (see § routed arcs) —
   one whose target is not its neighbour, so a bare glyph would point at the wrong
   node. This is where forward and backward edges *do* diverge, and the asymmetry is
   inherent: a forward edge runs with the layout grain, so a non-adjacent one is
   absorbed into the **branch/merge spine** (`├ ┐ ┴`) — it *is* the topology; a
   backward edge runs against the grain, so a non-adjacent one has nowhere in the
   spine to live and is drawn as an **explicit arc**.
9. **Self-edges** are also their own edge row — `⟲` is the direction glyph (a loop),
   name and `hash → hash` data intact; never collapsed onto the node row. A self-edge
   row sits **immediately above the contract node it loops on** — adjacent to that node,
   on the same (outgoing) side as the node's forward edges — so the loop reads as
   attached to its contract rather than floating between unrelated rows.
10. **Node overlays reuse the `migration list --graph` `(refs)` decoration** — *not*
    the old `migration graph` per-marker glyph tags (`◆ db`, `◇ contract`, rotating
    ref colours). Whatever points at a contract is appended to its node row as a single
    parenthetical, comma-separated name list — exactly the trailing `(…)` the flat list
    and `--graph` already draw on a migration's destination. Two names are reserved and
    ride the same parens alongside user ref names (styled to pop, never a separate
    glyph): `db` (the live database marker — "the DB is at this contract") and
    `contract` (the contract the working schema currently emits). A node nothing points
    at carries no decoration. See § node overlays.

### Routed arcs (node-skipping backward edges only)

Adjacent rollbacks are plain `↓` (rule 7). When a rollback skips over node rows to
reach a non-adjacent target, its lane is drawn as an explicit arc — in the **same
solid box-drawing as forward lanes**, **originating from its source node** (a tee off
the node row, the box-drawing-consistent way to attach an edge):

- `○─╮` — the arc tees off its **source node's row** into a back-lane.
- `│` — arc body (solid; the downward routing + landing arrowhead mark it as
  backward — no dashing needed, since direction is already unambiguous).
- `│↓` — the rollback's direction glyph sits **after its own lane's line** on its
  label row, identical in form to a forward edge's `│↑` (line then arrow); only the
  lane it occupies differs.
- `◂╯` / `◂─╯` — the arc turns in and points into its target node (the `─` bridges
  any freed lane between the arc and the node).

Overlapping back-arcs take separate adjacent back-lanes, allocated left-to-right;
where a later arc tees off a node whose row an earlier arc's lane crosses, the
crossing is `┼`.

The `from → to` data column is always present and authoritative; the gutter +
arrow are the visual aid.

---

## linear

```
○   a94b7b4
│↑  add_posts            ef9de27 → a94b7b4
○   ef9de27
│↑  init                 ∅ → ef9de27
○   ∅
```

## node overlays — refs, DB marker, current contract

The three "where am I" overlays use the **`migration list --graph` decoration
verbatim**: a trailing `(…)` of the names pointing at the contract, appended to the
**node row**. In the flat list that parenthetical hangs off a migration's destination;
here, where nodes *are* contracts, it hangs off the node itself. `db` and `contract`
are reserved names that share the parens with user refs. Order is stable: user refs
lexicographically, then `db`, then `contract`. (The active ref — the one you're working
against — may be bolded, the way the flat list bolds `db`.)

### the common case — DB one migration behind the current contract

Working schema emits `a94b7b4` (where `main` also points); the DB is still at
`ef9de27` (where `prod` also points). The "one pending migration" story is just the
gap between the `(contract)` row and the `(db)` row.

```
○   a94b7b4              (main, contract)
│↑  add_posts            ef9de27 → a94b7b4
○   ef9de27              (prod, db)
│↑  init                 ∅ → ef9de27
○   ∅
```

### everything aligned — fresh apply

After applying, the DB, the current contract, and `main` all point at the tip. All
three names collapse into one parenthetical; no glyph juggling.

```
○   a94b7b4              (main, db, contract)
│↑  add_posts            ef9de27 → a94b7b4
○   ef9de27
│↑  init                 ∅ → ef9de27
○   ∅
```

### detached current contract — changed but not yet planned

The working schema emits `c0ffee0`, but no migration produces it yet, so it is a node
with **no incoming edge** — a floating node carrying `(contract)`, exactly like the
disjoint-forest / dangling-parent roots. We deliberately **do not** draw the old
phantom dashed connector from the tip: an edge in this view is a migration, and there
is no migration here. The `(contract)` decoration, plus the absence of any edge into
the node, *is* the "you've changed your schema, run `migration plan`" signal.

```
○   c0ffee0              (contract)

○   a94b7b4              (main, db)
│↑  add_posts            ef9de27 → a94b7b4
○   ef9de27
│↑  init                 ∅ → ef9de27
○   ∅
```

## rollback

Both rollbacks target their layout-neighbour (the node directly below), so they are
plain `↓` rows — no arc. This mirrors forward `↑` exactly (same as `pure cycle`).

```
○   3ee5d20
│↑  add_bio              73e3abe → 3ee5d20
│↓  rollback_bio         3ee5d20 → 73e3abe
○   73e3abe
│↑  add_phone            ef9de27 → 73e3abe
│↓  rollback_phone       73e3abe → ef9de27
○   ef9de27
│↑  init                 ∅ → ef9de27
○   ∅
```

## diamond

`merge_bob` is the long edge — its lane (col 1) runs from the top fan down past
`73e3abe` to its parent `6656a6e`, but it's one continuous lane carrying one `↑`.

```
○   3b2d98d
├─┐
│↑│   merge_alice        73e3abe → 3b2d98d
│ │↑  merge_bob          6656a6e → 3b2d98d
○ │   73e3abe
│↑│   alice_add_phone    ef9de27 → 73e3abe
│ ○   6656a6e
│ │↑  bob_add_avatar     ef9de27 → 6656a6e
├─┘
○   ef9de27
│↑  init                 ∅ → ef9de27
○   ∅
```

## sequential-diamonds

`3b2d98d` is the convergence of the lower diamond **and** the divergence of the
upper one — one row, both jobs.

```
○   cd5c15b
├─┐
│↑│   merge_2a           0276f92 → cd5c15b
│ │↑  merge_2b           a94b7b4 → cd5c15b
○ │   0276f92
│↑│   add_comments       3b2d98d → 0276f92
│ ○   a94b7b4
│ │↑  add_posts_branch   3b2d98d → a94b7b4
├─┘
○   3b2d98d
├─┐
│↑│   merge_1a           73e3abe → 3b2d98d
│ │↑  merge_1b           6656a6e → 3b2d98d
○ │   73e3abe
│↑│   alice_add_phone    ef9de27 → 73e3abe
│ ○   6656a6e
│ │↑  bob_add_avatar     ef9de27 → 6656a6e
├─┘
○   ef9de27
│↑  init                 ∅ → ef9de27
○   ∅
```

## converging-branches (3-way fan — the resolved stress case)

The arrow-in-lane carries the three merge rows and three add rows with no colour.

```
○   3116048
├─┬─╮
│↑│ │   merge_phone      73e3abe → 3116048
│ │↑│   merge_posts      a94b7b4 → 3116048
│ │ │↑  merge_avatar     6656a6e → 3116048
○ │ │   73e3abe
│↑│ │   add_phone        ef9de27 → 73e3abe
│ ○ │   a94b7b4
│ │↑│   add_posts        ef9de27 → a94b7b4
│ │ ○   6656a6e
│ │ │↑  add_avatar       ef9de27 → 6656a6e
├─┴─╯
○   ef9de27
│↑  init                 ∅ → ef9de27
○   ∅
```

## wide-fan — pure divergence, no reconvergence

One contract (`ef9de27`) with N children that never reconverge — each child is its own
tip. This is the mirror of `converging-branches`: instead of a convergence node at the
top fanning down, there is no top node at all — N separate tips each open a lane, and all
N lanes **merge down into the shared parent** at the bottom (one merge connector, no branch
connector). Sibling tips open lanes in creation order (col 0 = oldest tip, the same input
order every fan uses); the divergence reads as the lanes coming together into `ef9de27`.

```
○             73e3abe
│↑            add_phone           ef9de27 → 73e3abe
│ ○           a94b7b4
│ │↑          add_posts           ef9de27 → a94b7b4
│ │ ○         6656a6e
│ │ │↑        add_avatar          ef9de27 → 6656a6e
│ │ │ ○       becd3f1
│ │ │ │↑      add_category        ef9de27 → becd3f1
│ │ │ │ ○     b01f4d9
│ │ │ │ │↑    add_settings        ef9de27 → b01f4d9
├─┴─┴─┴─╯
○             ef9de27
│↑            init                ∅ → ef9de27
○             ∅
```

## sub-branches — nested divergence, lanes reused

`ef9de27` diverges to `{73e3abe, 6656a6e}`, and `73e3abe` itself diverges to
`{a94b7b4, 3ee5d20}`. Because each divergence's child-lanes merge back into their own
parent (not into each other), the **same two lanes are reused** for both fans — no extra
width. Each fan is a merge connector above its divergence node, exactly like `wide-fan`,
just stacked.

```
○       a94b7b4
│↑      add_posts            73e3abe → a94b7b4
│ ○     3ee5d20
│ │↑    add_bio              73e3abe → 3ee5d20
├─╯
○       73e3abe
│↑      add_phone            ef9de27 → 73e3abe
│ ○     6656a6e
│ │↑    add_avatar           ef9de27 → 6656a6e
├─╯
○       ef9de27
│↑      init                 ∅ → ef9de27
○       ∅
```

## diamond-sub-branch — a diamond with a leaf spur off one arm

The lower diamond is the familiar `73e3abe`/`6656a6e → 3b2d98d` shape (lanes 0/1). One arm,
`6656a6e`, *also* diverges into a leaf spur (`bob_experiment → becd3f1 → b01f4d9`), so
`6656a6e` is both a diamond arm **and** a divergence: its `merge_bob` lane (1) and its spur
lane (2) merge into it. The spur takes a third lane that opens at its tip `b01f4d9` and
closes at `6656a6e`.

```
○         3b2d98d
├─╮
│↑│       merge_alice        73e3abe → 3b2d98d
│ │↑      merge_bob          6656a6e → 3b2d98d
○ │       73e3abe
│↑│       alice_add_phone    ef9de27 → 73e3abe
│ │ ○     b01f4d9
│ │ │↑    bob_experiment_2   becd3f1 → b01f4d9
│ │ ○     becd3f1
│ │ │↑    bob_experiment     6656a6e → becd3f1
│ ├─╯
│ ○       6656a6e
│ │↑      bob_add_avatar     ef9de27 → 6656a6e
├─╯
○         ef9de27
│↑        init               ∅ → ef9de27
○         ∅
```

## complex — divergence + diamond + spine + a leaf tip

`ef9de27` diverges three ways: into the diamond arms (`73e3abe`, `6656a6e`, which reconverge
at `3b2d98d`) and into a standalone leaf tip `a94b7b4` (`staging_posts`). Above the diamond,
a linear spine continues (`3b2d98d → 0276f92 → cd5c15b`). The leaf tip sits low — where it
topologically belongs, one edge above the divergence — so its lane (2) is short, exactly
like `kitchen-sink`'s short branch. All three lanes merge into `ef9de27`.

```
○         cd5c15b
│↑        add_tags           0276f92 → cd5c15b
○         0276f92
│↑        add_comments       3b2d98d → 0276f92
○         3b2d98d
├─╮
│↑│       merge_alice        73e3abe → 3b2d98d
│ │↑      merge_bob          6656a6e → 3b2d98d
○ │       73e3abe
│↑│       alice_add_phone    ef9de27 → 73e3abe
│ ○       6656a6e
│ │↑      bob_add_avatar     ef9de27 → 6656a6e
│ │ ○     a94b7b4
│ │ │↑    staging_posts      ef9de27 → a94b7b4
├─┴─╯
○         ef9de27
│↑        init               ∅ → ef9de27
○         ∅
```

## multi-edge — parallel migrations between one pair

Several migrations can connect the **same two contracts** — same `from`, same `to`. This is a
multigraph edge, *not* a divergence and *not* a convergence: it happens when more than one
migration independently produces the same resulting contract from the same starting contract
(e.g. two developers each author a migration `aaaaaaa → bbbbbbb`). The real world is messy.

Each migration is still its own row (rule 3), and because every one connects the same adjacent
pair, each is a plain `│↑` (rule 7) — they **stack in the one lane, no fan**. A fan would be
wrong: the edges do not branch (one source) and do not merge (one target). Order follows the
same recency ordering the flat list uses (newest first; descending `dirName` in this example).

```
○   bbbbbbb
│↑  variant_c            aaaaaaa → bbbbbbb
│↑  variant_b            aaaaaaa → bbbbbbb
│↑  variant_a            aaaaaaa → bbbbbbb
○   aaaaaaa
│↑  init                 ∅ → aaaaaaa
○   ∅
```

(The `multi-branch` fixture is the real-world instance: four migrations `3ee5d20 → bdc08a6`.)

## cross-link — nonlinear forward history

`A→B→C`, `A→D→E`, plus a cross edge `B→E`. `B` diverges (to `C` and `E`); `E`
converges (from `B` and `D`). The cross edge is just a forward lane that spans rows
and **joins at the shared node** — exactly like the diamond's long edge. It does not
break the model: the lane allocator joins any lanes that want the same node, so
`B→E`'s lane (col 1) joins the `C`-lane at `B`, and both child-lanes of `A` join at
the root.

```
○        C
│↑       B→C             B → C
│ ○      E
│ ├─╮
│ │↑│    B→E             B → E
│ │ │↑   D→E             D → E
├─┘ │
○   │    B
│↑  │    A→B             A → B
│   ○    D
│   │↑   A→D             A → D
├───┘
○        A
```

## kitchen-sink — divergence + an adjacent rollback cycle (no arc)

`ef9de27` diverges into a long branch (col 0, with a `0276f92 ⇄ e9bd4aa` cycle at
its tip) and a short branch (col 1). The cycle's rollback targets its neighbour
`0276f92`, so it is a plain `↓` (rule 7) — ordering the forward arrival above the
rollback departure keeps it adjacent. The short branch's tip `bdc08a6` sits where it
topologically belongs — two edges above the divergence — with col 0 running up past
it alone (unequal branch lengths, like `git log --graph`).

```
○      e9bd4aa
│↑     kitchen_sink      0276f92 → e9bd4aa
│↓     rollback          e9bd4aa → 0276f92
○      0276f92
│↑     add_comments      a94b7b4 → 0276f92
○      a94b7b4
│↑     add_posts         c81f321 → a94b7b4
○      c81f321
│↑     change_default    b1858bc → c81f321
○      b1858bc
│↑     email_default     73e3abe → b1858bc
○      73e3abe
│↑     add_phone         ef9de27 → 73e3abe
│ ○    bdc08a6
│ │↑   migration         cc527d2 → bdc08a6
│ ○    cc527d2
│ │↑   widen_email       ef9de27 → cc527d2
├─┘
○      ef9de27
│↑     init              ∅ → ef9de27
○      ∅
```

## routed arcs — node-skipping rollbacks (the only case with arcs)

### skip-rollback — two overlapping back-arcs

Here the rollbacks genuinely jump over a node, so a plain `↓` would point at the
wrong neighbour — these are the cases that need a routed arc. `rollback_to_phone`
(col 1, `a94b7b4 → 73e3abe`, skipping `3ee5d20`) and `rollback_to_init` (col 2,
`3ee5d20 → ef9de27`, skipping `73e3abe`) overlap in row-span, so they take adjacent
back-lanes; each tees off its source node and lands across the gutter into its target.

```
○─╮       a94b7b4
│ │↓      rollback_to_phone   a94b7b4 → 73e3abe
│↑│       add_posts           3ee5d20 → a94b7b4
○─┼─╮     3ee5d20
│ │ │↓    rollback_to_init    3ee5d20 → ef9de27
│↑│ │     add_bio             73e3abe → 3ee5d20
○◂╯ │     73e3abe
│↑  │     add_phone           ef9de27 → 73e3abe
○◂──╯     ef9de27
│↑        init                ∅ → ef9de27
○         ∅
```

### multi-rollback-branch — divergence + a node-skipping rollback (composed, deferred)

This fixture composes a nested divergence (`73e3abe → {a94b7b4, 3ee5d20→0276f92→cd5c15b}`)
with a back edge `0276f92 → 73e3abe` that skips `3ee5d20` — a routed back-arc teeing off
`0276f92` and landing across the gutter into `73e3abe`. Because it needs **both** the
generalised divergence allocator *and* the routed-arc machinery, its full rendering is
deferred until both land; the divergence half is captured by `sub-branches` above and the
arc half by `skip-rollback`.

## disjoint forest (the real world is messy)

Two unrelated components, stacked with a blank separator. The second component's
root is **not** `∅` — its parent was pruned (no `○ ∅` beneath it).

```
○   bbbbbbb
│↑  app_next             aaaaaaa → bbbbbbb
○   aaaaaaa
│↑  app_init             ∅ → aaaaaaa
○   ∅

○   ddddddd
│↑  other_root           ccccccc → ddddddd
○   ccccccc
```

## dangling parent

```
○   fffffff
│↑  continue             eeeeeee → fffffff
○   eeeeeee
│↑  after_prune          ddddddd → eeeeeee
○   ddddddd
```

## self-edge

A no-op migration whose result equals its input. It's still an edge with a name
and ops, so it gets its own row — `⟲` is just the direction glyph (a loop, neither
up nor down), and the `hash → hash` data column makes the self-loop self-evident.
The self-edge row sits **immediately above the node it loops on** (`aaaaaaa`), grouped
with that node's outgoing edges, so the loop reads as attached to its contract.

```
○   bbbbbbb
│↑  next                 aaaaaaa → bbbbbbb
│⟲  noop                 aaaaaaa → aaaaaaa
○   aaaaaaa
│↑  init                 ∅ → aaaaaaa
○   ∅
```

## pure cycle

Forward `↑` and rollback `↓` between two contracts, nothing else.

```
○   bbbbbbb
│↑  forward              aaaaaaa → bbbbbbb
│↓  rollback             bbbbbbb → aaaaaaa
○   aaaaaaa
```
