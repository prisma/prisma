import { describe, expect, it } from 'vitest';
import { bfs } from '../src/graph-ops';

/**
 * Fixture: a tiny explicit edge list. Encoded as (from → to).
 *   A → B
 *   A → C
 *   B → D
 *   C → D
 *   D → E
 */
interface TestEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

function forward(edges: readonly TestEdge[]) {
  return (node: string): Iterable<{ next: string; edge: TestEdge }> => {
    return edges.filter((e) => e.from === node).map((e) => ({ next: e.to, edge: e }));
  };
}

function reverse(edges: readonly TestEdge[]) {
  return (node: string): Iterable<{ next: string; edge: TestEdge }> => {
    return edges.filter((e) => e.to === node).map((e) => ({ next: e.from, edge: e }));
  };
}

const sampleEdges: readonly TestEdge[] = [
  { from: 'A', to: 'B' },
  { from: 'A', to: 'C' },
  { from: 'B', to: 'D' },
  { from: 'C', to: 'D' },
  { from: 'D', to: 'E' },
];

describe('bfs (string-keyed overload)', () => {
  it('visits every reachable node exactly once starting from a single root', () => {
    const visited: string[] = [];
    for (const step of bfs(['A'], forward(sampleEdges))) {
      visited.push(step.state);
    }
    expect(visited.sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('yields the starting node with parent=null and incomingEdge=null', () => {
    const first = bfs(['A'], forward(sampleEdges)).next();
    expect(first.done).toBe(false);
    if (first.done) return;
    expect(first.value.state).toBe('A');
    expect(first.value.parent).toBeNull();
    expect(first.value.incomingEdge).toBeNull();
  });

  it('yields parent and incomingEdge for non-start nodes', () => {
    const steps = [...bfs(['A'], forward(sampleEdges))];
    const b = steps.find((s) => s.state === 'B');
    expect(b?.parent).toBe('A');
    expect(b?.incomingEdge).toEqual({ from: 'A', to: 'B' });
  });

  it('supports multiple start nodes', () => {
    // Two disconnected components: A→B and X→Y.
    const edges: readonly TestEdge[] = [
      { from: 'A', to: 'B' },
      { from: 'X', to: 'Y' },
    ];
    const visited = new Set<string>();
    for (const step of bfs(['A', 'X'], forward(edges))) {
      visited.add(step.state);
    }
    expect(visited).toEqual(new Set(['A', 'B', 'X', 'Y']));
  });

  it('supports reverse traversal when neighbours return incoming edges', () => {
    // Start at E and walk back to A via reverse edges.
    const visited: string[] = [];
    for (const step of bfs(['E'], reverse(sampleEdges))) {
      visited.push(step.state);
    }
    expect(visited.sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('respects neighbour order when the closure pre-sorts', () => {
    // Diamond A→B→D and A→C→D. The neighbours closure pre-sorts so edges
    // labelled 'main' are visited first; D's parent must be C (via main).
    const edges: readonly TestEdge[] = [
      { from: 'A', to: 'B', label: 'feature' },
      { from: 'A', to: 'C', label: 'main' },
      { from: 'B', to: 'D' },
      { from: 'C', to: 'D' },
    ];
    const preferMain = (node: string): Iterable<{ next: string; edge: TestEdge }> =>
      [...forward(edges)(node)].sort((a, b) => {
        if (a.edge.label === 'main' && b.edge.label !== 'main') return -1;
        if (b.edge.label === 'main' && a.edge.label !== 'main') return 1;
        return 0;
      });

    const steps = [...bfs(['A'], preferMain)];
    const dStep = steps.find((s) => s.state === 'D');
    expect(dStep?.parent).toBe('C');
  });

  it('does not revisit nodes in a cyclic graph', () => {
    const edges: readonly TestEdge[] = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'A' }, // back-edge
    ];
    const visited: string[] = [];
    for (const step of bfs(['A'], forward(edges))) {
      visited.push(step.state);
    }
    expect(visited).toEqual(['A', 'B', 'C']);
  });

  it('supports early termination via break', () => {
    const visited: string[] = [];
    for (const step of bfs(['A'], forward(sampleEdges))) {
      visited.push(step.state);
      if (step.state === 'B') break;
    }
    expect(visited).toContain('A');
    expect(visited).toContain('B');
    expect(visited).not.toContain('D');
    expect(visited).not.toContain('E');
  });

  it('yields nothing when starts is empty', () => {
    const visited: string[] = [];
    for (const step of bfs([], forward(sampleEdges))) {
      visited.push(step.state);
    }
    expect(visited).toEqual([]);
  });

  it('deduplicates start nodes', () => {
    const visited: string[] = [];
    for (const step of bfs(['A', 'A', 'A'], forward(sampleEdges))) {
      visited.push(step.state);
    }
    expect(visited.filter((n) => n === 'A')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Composite-state overload — caller supplies a `key` function to dedup on a
// derived equality. The case the migration code uses is `(node, mask)` for
// invariant-aware path-finding; here we test the simpler `(node, depth)`
// shape so the test stays focused on the BFS plumbing rather than the
// invariant logic.
// ---------------------------------------------------------------------------

describe('bfs (composite-state overload)', () => {
  interface Composite {
    readonly node: string;
    readonly depth: number;
  }
  const compositeKey = (s: Composite) => `${s.node}@${s.depth}`;

  it('dedups on the composite key, not the node alone', () => {
    // Graph: A → B with one edge. From state (A,0) we visit both
    // (B,1) and (B,2) by emitting two distinct depth-tagged transitions
    // out of A. Node-keyed dedup would visit B once; composite-keyed
    // dedup visits it twice (different states).
    const edges: readonly TestEdge[] = [{ from: 'A', to: 'B' }];
    const neighbours = (s: Composite): Iterable<{ next: Composite; edge: TestEdge }> => {
      // Emit two transitions to B at different depths to force composite
      // dedup to admit both.
      if (s.node !== 'A') return [];
      const e = edges[0]!;
      return [
        { next: { node: e.to, depth: 1 }, edge: e },
        { next: { node: e.to, depth: 2 }, edge: e },
      ];
    };
    const visited: Composite[] = [];
    for (const step of bfs<Composite, TestEdge>(
      [{ node: 'A', depth: 0 }],
      neighbours,
      compositeKey,
    )) {
      visited.push(step.state);
    }
    expect(visited).toEqual([
      { node: 'A', depth: 0 },
      { node: 'B', depth: 1 },
      { node: 'B', depth: 2 },
    ]);
  });

  it('parent state is the full composite, not just the node', () => {
    const edges: readonly TestEdge[] = [{ from: 'A', to: 'B' }];
    const neighbours = (s: Composite): Iterable<{ next: Composite; edge: TestEdge }> => {
      if (s.node !== 'A') return [];
      return [{ next: { node: 'B', depth: s.depth + 1 }, edge: edges[0]! }];
    };
    const steps = [
      ...bfs<Composite, TestEdge>([{ node: 'A', depth: 0 }], neighbours, compositeKey),
    ];
    const b = steps.find((s) => s.state.node === 'B');
    expect(b?.parent).toEqual({ node: 'A', depth: 0 });
  });
});
