# ADR 229 — Migration graph renderer uses a line/plane/occlusion model

## Status

Accepted. Refines [ADR 227 — Migration read commands share one graphical renderer with command-specific annotations](./ADR%20227%20-%20Migration%20read%20commands%20share%20one%20graphical%20renderer%20with%20command-specific%20annotations.md), which establishes that one renderer draws the migration topology for every read command. This ADR is about how that renderer is built internally.

## A worked example

A space has three forward migrations and one rollback. `000_init` through `002_fwd_bc` advance the history; `003_rollback` then rolls back from `arc_c` to `arc_a`, skipping `arc_b`. Here is `migration graph` drawing it — newest contract at the top, the empty contract `∅` at the bottom:

```text
○─╮   arc_c
│ │↓  003_rollback
│↑│   002_fwd_bc
○ │   arc_b
│↑│   001_fwd_ab
○◂╯   arc_a
│↑    000_init
○     ∅
```

The forward history runs straight up the left column: each `○` is a contract, each `│↑` a forward migration. `003_rollback` cannot be a plain downward edge because it skips `arc_b`, so it is routed as an arc — it leaves `arc_c` through the corner `─╮` into a lane of its own to the right of the trunk, runs down that lane as `│`, and lands on `arc_a` at the `◂╯`, where the `◂` marks the arrival.

Two things in that picture drive the whole design. The rollback is a different colour from the trunk, and it gets its own column rather than being crammed into the trunk's. That is deliberate: a single text cell can hold only one glyph in one colour, so two differently-coloured lines must never be made to share one. Where lines genuinely have to overlap — a routed arc passing over another line at a crossing — one of them has to win the cell and the other has to give way, and each must keep its own colour. Deciding that unambiguously is what the renderer is built around.

## Decision

The renderer is modelled around **lines**, drawn by **occlusion**, into cells with a **single owner**.

- **A line is the primitive, not a cell.** Each migration edge becomes a routed line that carries its own identity — which migration it is, which lane it occupies, and (in highlight mode) whether it is on or off the chosen path. Colour is a property of the line and is always read off the line; it is never inferred from a cell's position in the grid.
- **Overlap is resolved by occlusion.** Each cell holds a z-ordered stack of the lines passing through it. The renderer draws the topmost line and clips the rest. There is no glyph that blends two lines.
- **Every cell has exactly one drawable owner.** The layout guarantees this before the renderer runs, so rendering a cell is a direction-to-glyph lookup and a colour read, with no junction logic and no colour arbitration.

Because lanes are reused — a column that carries one edge near the top carries a different edge lower down — colour cannot be a property of a position. If it were, the renderer would have to reconstruct which edge owns a given cell, and that reconstruction is exactly where colour bleeds. Making the line the primitive and giving it first-class identity means a cell's colour always belongs honestly to one line.

## How it works

### Two phases: layout, then render

Rendering is split into a phase that thinks and a phase that does not.

**Layout** (`migration-graph-grid-layout.ts`) is where every geometry and topology decision lives. It routes each edge as a line across a grid of cells and records, for each cell a line passes through, the **directions** the line occupies there (which of up / down / left / right) and the **plane** it sits on (its z-order). A cell therefore holds an ordered set of the lines present in it, and layout guarantees the single-owner invariant before handing the grid on.

**Render** (`migration-graph-occlusion-render.ts`) is a projection with no knowledge of topology. For each cell it takes the topmost line (lowest plane number), derives the glyph from that line's directions — a box-drawing character for the verticals and corners, with `○` / `∅` node markers and `↑ ↓ ⟲` arrows layered on top — takes the colour straight off that line, and occludes the rest.

### The single-owner invariant

Keeping each cell owned by one line is what makes colour correct by construction. Two rules enforce it:

- **No tees.** The glyph alphabet is verticals, corners, arrows, and node markers — never `├ ┬ ┼`. A tee is the only glyph that bundles a through-line and a branch into one cell; without it, that bundling cannot happen. A fork or a merge is drawn as one continuous line (a `│` or a sweeping corner) plus, for every other branch, that branch's own corner in its own cell.
- **Two columns per lane.** Each lane occupies a **rail column** (the single-owner vertical) and a **connector column** (corners and horizontals). Turns happen in the connector column, never crammed into a rail. The count is the named parameter `colsPerLane` (default 2).

With one owner per cell, the colour of every cell is simply the colour of its line — there is never a second branch to compromise with.

### Planes and z-order

A cell is a z-ordered stack of lines; the lowest plane number is drawn and everything above it is occluded. One rule then covers every kind of overlap:

- **Crossings** — two lines pass through a cell; the top one is drawn, the lower one is clipped.
- **Forks and merges** — several lines meet at a node; the top line is drawn continuous, and each other line yields beneath it, cornering off into its own connector cell. A merge is not a special junction — it is one continuous line plus N yielding corners, which scales to any number of parents or children.

Which line is on top is the one thing that differs by mode:

- **Flat (multi-colour) mode → trunk on top.** The main lane stays an unbroken `│` and later parents corner in beneath it (`│─╮─╮…`) — a compact, git-log-style picture.
- **Focus mode (`migrate --show`) → the on-path line on top.** The chosen path is lifted above everything and drawn as one continuous prominent line sweeping through merges (`╰───╮`), while off-path branches yield beneath it.

### Back-arcs

A rollback runs against the forward grain of the DAG, so it is routed on its own back-lane to the right of the trunk and drawn on an upper plane, continuous. Where a back-arc crosses a forward vertical, the forward line clips and the back-arc runs through.

When several rollbacks land on the same target node, they share one back-lane rather than each taking its own: the sources converge and a single landing closes onto the node. This keeps the graph narrow and removes crossings. Each arc keeps its own colour on the segment it owns; occlusion arbitrates the shared rail.

### Colour

In flat mode, lanes are coloured by greedy assignment. Walking the rows from the bottom up, each diverging branch and each back-arc takes the lowest palette colour not currently in use by a lane alive alongside it; a back-arc additionally avoids its origin branch's colour and the on-path green. Colours are released when a lane ends and reused later. This guarantees two things: branches visible at the same time are always distinguishable, and a rollback never wears the colour of the branch it springs from. Where back-arcs share a rail, the arc whose source is lowest in the display is drawn on top.

In focus mode the lane palette is set aside: the on-path line is green and continuous, off-path lines are dim. Because colour is read off the owning line and a cell has a single owner, an off-path line can never bleed green into an on-path cell or vice versa.

### Layout invariants

Beyond the per-cell rules, the layout holds the overall shape together:

- **Disconnected components** (independent histories with no shared contract) each render as their own block starting at lane 0, separated by a blank line, rather than interleaving.
- **Asymmetric diamonds** — a fork whose two arms differ in length and reconverge — keep the merge node, and any trunk that continues past it, on the lane-0 trunk; the shorter arm is the side-branch.

These shapes are pinned by regression goldens under `cli/test/utils/formatters/`.

### Geometry

Spacing is parameterised, not hard-coded. `colsPerLane` (default 2) is a named constant on the grid options, threaded through both the layout and the renderer, so the density of the graph can change without editing renderer code. Other spacing constants (hash-column width, label gaps) are likewise named.

### Data structures

`migration-graph-model.ts` defines the grid the two phases share:

```ts
type Direction = 'up' | 'down' | 'left' | 'right';
type PathRole = 'on-path' | 'off-path';

// Identity, carried into every cell the line touches.
interface LineRef {
  readonly migrationHash: string;
  readonly dirName: string;
  readonly lane: number;                 // selects the lane's colour
  readonly role: PathRole | undefined;   // set in focus mode; undefined in flat mode
}

// One line's presence in one cell.
interface CellLine {
  readonly line: LineRef;
  readonly directions: ReadonlySet<Direction>;
  readonly plane: number;                // z-order; lower number = drawn on top
  readonly selfLoop?: boolean;           // a ⟲ self-edge
  readonly landingArrow?: boolean;       // the ◂ where a back-arc lands on its target
}

interface NodeRef {
  readonly contractHash: string;
  readonly isEmpty: boolean;             // the ∅ baseline node
  readonly lane: number;
  readonly role: PathRole | undefined;
}

interface Cell {
  readonly node?: NodeRef;               // a contract marker; never shares a cell with a line
  readonly lines: readonly CellLine[];   // ordered set of lines present
}

type Grid = readonly (readonly Cell[])[];   // rows × columns, row 0 = top of the display
```

Rendering a cell: pick the line with the minimum `plane`, derive its glyph from the union of that line's `directions`, colour it from the line, and layer any node or arrow marker on top.

The glyph and layout vocabulary the renderer draws — every box-drawing character and what each fixture topology looks like — is catalogued in the [migration graph visual language](../../reference/Migration%20Graph%20Visual%20Language.md) reference.

## Consequences

- **Colour is correct by construction.** Because every cell has a single owning line and colour is read off the line, there is no path by which one branch's colour reaches another branch's cell. The property holds without a verification pass.
- **The renderer has no junction logic.** No tee glyphs, no priority rules at crossings, no colour arbitration — the render phase is a direction-to-glyph lookup and a colour read. All topology lives in layout.
- **Merges scale uniformly.** A merge is one continuous line plus N yielding corners, so a node with any number of parents or children draws with the same rule; there is no special case per arity.
- **The two modes differ in exactly one knob.** Flat vs focus changes only which line sits on top of the stack; everything downstream is identical.
- **Traceability through a crossing is given up.** Occlusion clips the lower line at a crossing, so a reader cannot follow a single line unbroken through every cell it passes. This is the deliberate trade for unambiguous per-cell colour — see Alternatives.

## Alternatives considered

- **Colour keyed by cell position rather than by line.** Store colour on the grid cell and infer, at render time, which edge owns each cell. Rejected. Lanes are reused down the height of the graph, so a position does not identify an edge; the renderer would have to reconstruct ownership, and that reconstruction is precisely where colour bleeds between branches. Carrying identity on the line removes the reconstruction entirely.

- **Blended junction glyphs instead of occlusion.** Draw a crossing as a combined glyph — a `┼` where two lines meet — coloured by whichever line wins a priority rule. This keeps both lines traceable through the crossing, but a single glyph can only carry one colour, so it necessarily misrepresents the other line (a green `┼` sitting in the middle of a grey rollback arc). Rejected. Occlusion gives up traceability through a crossing in exchange for every cell's colour being honest about exactly one line, and unambiguous colour is the property the whole renderer is built around.

- **Tee glyphs for forks and merges.** Allow `├ ┬ ┼` so a fork or merge fits in one cell. Rejected. A tee is the one glyph that bundles a through-line and a branch into a single cell, which breaks the single-owner invariant and reintroduces the question of what colour the shared cell is. Spending a second column per lane to draw the branch as its own corner is cheaper than the colour ambiguity a tee brings back.

## References

- [ADR 227 — Migration read commands share one graphical renderer with command-specific annotations](./ADR%20227%20-%20Migration%20read%20commands%20share%20one%20graphical%20renderer%20with%20command-specific%20annotations.md) — the command-level architecture this renderer sits under.
- [Migration graph visual language](../../reference/Migration%20Graph%20Visual%20Language.md) — the glyph and layout catalogue the renderer draws from.
