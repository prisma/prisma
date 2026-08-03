import { InternalError } from '@internal/utils/internal-error';
import type { DiffableNode, SchemaDiffIssue } from './schema-diff';

const PATH_DELIMITER = ' ';

function pathKey(path: readonly string[]): string {
  return path.join(PATH_DELIMITER);
}

/**
 * Whether an issue's op builds its subject up (create or alter) rather than
 * only tearing it down. The differ sets `expected` on every create (`not-found`)
 * and alter (`not-equal`) issue and leaves it absent on a pure drop
 * (`not-expected`). This is the single signal the ordering law reads for edge
 * direction — never `reason`.
 */
function buildsUp(issue: SchemaDiffIssue): boolean {
  return issue.expected !== undefined;
}

/**
 * The nearest strict-ancestor bucket of `path` — the surviving parent entity a
 * child is contained by. Walks the path's proper prefixes from longest to
 * shortest and returns the first prefix that maps to a bucket; a gap (a prefix
 * with no bucket) is skipped so containment always attaches to the closest real
 * parent.
 *
 * Returns a list because a path prefix can be shared by two siblings of
 * different `nodeKind` (a role and a namespace named alike); linking the child
 * to every candidate over-constrains safely (the extra edge points at a same-
 * direction op and never forms a cycle, since a parent never depends on its
 * child) rather than risk picking the wrong one.
 */
function nearestAncestors<T>(
  path: readonly string[],
  byPath: ReadonlyMap<string, readonly T[]>,
): readonly T[] {
  for (let end = path.length - 1; end >= 1; end -= 1) {
    const bucket = byPath.get(pathKey(path.slice(0, end)));
    if (bucket !== undefined) return bucket;
  }
  return [];
}

/**
 * Orders schema-diff issues so that every dependency's op precedes its
 * dependent on the way up and follows it on the way down, breaking ties
 * deterministically by path.
 *
 * Edges come from two sources:
 * - **`dependsOn` cross-links** — the resolved issue-to-issue paths the differ
 *   mirrors onto each issue (a node's declared structural prerequisites). A
 *   path that resolves to no issue in this list is skipped (the dependency is
 *   satisfied by reality); a path shared by two same-id/different-kind siblings
 *   links to every match, over-constraining safely.
 * - **containment** — every issue depends on its nearest strict-ancestor issue
 *   (a child entity on the parent entity that owns it). Subtree coalescing has
 *   already removed the descendants of a whole create/drop, so this only links
 *   the parent/child pairs that legitimately survive together.
 *
 * The ordering law reads each dependent's presence for direction: an issue that
 * builds up (`expected` present — a create or alter) needs its dependency
 * first; a pure drop needs its dependent removed first, so the edge reverses.
 * The graph is a DAG by construction (dependencies point from dependents to
 * their prerequisites, and prerequisites never point back), so a cycle is a
 * derivation or authoring bug: the topological sort asserts acyclicity and
 * throws, naming the issues it could not place.
 */
export function orderIssuesByDependencies<TNode extends DiffableNode = DiffableNode>(
  issues: readonly SchemaDiffIssue<TNode>[],
): readonly SchemaDiffIssue<TNode>[] {
  if (issues.length <= 1) return issues;

  // Work with node records rather than parallel arrays indexed by number, so no
  // step needs an unchecked array-index read.
  type OrderNode = {
    readonly issue: SchemaDiffIssue<TNode>;
    /** Path key, used as the deterministic tiebreak among ready nodes. */
    readonly key: string;
    /** Whether this issue builds up (create/alter) — the ordering law's direction signal. */
    readonly buildsUp: boolean;
    /** Nodes that must be emitted after this one. */
    readonly outgoing: Set<OrderNode>;
    inDegree: number;
  };

  const nodes: OrderNode[] = issues.map((issue) => ({
    issue,
    key: pathKey(issue.path),
    buildsUp: buildsUp(issue),
    outgoing: new Set<OrderNode>(),
    inDegree: 0,
  }));

  const nodesByPath = new Map<string, OrderNode[]>();
  for (const node of nodes) {
    const bucket = nodesByPath.get(node.key);
    if (bucket === undefined) nodesByPath.set(node.key, [node]);
    else bucket.push(node);
  }

  const addEdge = (before: OrderNode, after: OrderNode): void => {
    if (before.outgoing.has(after)) return;
    before.outgoing.add(after);
    after.inDegree += 1;
  };
  // `dependent` requires `dependency` to exist. Up (dependent builds up): the
  // dependency's op runs first; down (a pure drop): the dependent's op runs
  // first, so the edge reverses.
  const addDependency = (dependent: OrderNode, dependency: OrderNode): void => {
    if (dependent === dependency) return;
    if (dependent.buildsUp) addEdge(dependency, dependent);
    else addEdge(dependent, dependency);
  };

  for (const node of nodes) {
    for (const targetPath of node.issue.dependsOn ?? []) {
      for (const target of nodesByPath.get(pathKey(targetPath)) ?? []) {
        addDependency(node, target);
      }
    }
    for (const ancestor of nearestAncestors(node.issue.path, nodesByPath)) {
      addDependency(node, ancestor);
    }
  }

  const ready: OrderNode[] = nodes.filter((node) => node.inDegree === 0);
  const order: OrderNode[] = [];
  while (ready.length > 0) {
    // Kahn's algorithm: emit the ready node with the smallest path key, so
    // independent issues come out in a stable, deterministic order.
    let best: OrderNode | undefined;
    for (const candidate of ready) {
      if (best === undefined || candidate.key < best.key) best = candidate;
    }
    if (best === undefined) break;
    ready.splice(ready.indexOf(best), 1);
    order.push(best);
    for (const next of best.outgoing) {
      next.inDegree -= 1;
      if (next.inDegree === 0) ready.push(next);
    }
  }

  if (order.length !== nodes.length) {
    const placed = new Set(order);
    const unresolved = nodes
      .filter((node) => !placed.has(node))
      .map((node) => node.issue.path.join('/'));
    throw new InternalError(
      `orderIssuesByDependencies: dependency cycle among schema-diff issues (unresolved: ${unresolved.join(', ')})`,
    );
  }

  return order.map((node) => node.issue);
}
