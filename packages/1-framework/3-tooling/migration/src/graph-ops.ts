import { Queue } from './queue';

/**
 * One step of a BFS traversal.
 *
 * `parent` and `incomingEdge` are `null` for start states — they were not
 * reached via any edge. For every other state they record the predecessor
 * state and the edge by which this state was first reached.
 *
 * `state` is the BFS state, most often a string (graph node identifier) but
 * can be a composite object. The string overload keeps the common case
 * ergonomic; the generic overload accepts a caller-supplied `key` function
 * that produces a stable equality key for dedup.
 */
export interface BfsStep<S, E> {
  readonly state: S;
  readonly parent: S | null;
  readonly incomingEdge: E | null;
}

/**
 * Generic breadth-first traversal.
 *
 * Direction (forward/reverse) is expressed by the caller's `neighbours`
 * closure: return `{ next, edge }` pairs where `next` is the state to visit
 * next and `edge` is the edge that connects them. Callers that don't need
 * path reconstruction can ignore the `parent`/`incomingEdge` fields of each
 * yielded step.
 *
 * Ordering — when the result needs to be deterministic (path-finding) the
 * caller is responsible for sorting inside `neighbours`; this generator
 * does not impose an ordering hook of its own. State-dependent orderings
 * have full access to the source state inside the closure.
 *
 * Stops are intrinsic — callers `break` out of the `for..of` loop when
 * they've found what they're looking for.
 */
export function bfs<E>(
  starts: Iterable<string>,
  neighbours: (state: string) => Iterable<{ next: string; edge: E }>,
): Generator<BfsStep<string, E>>;
export function bfs<S, E>(
  starts: Iterable<S>,
  neighbours: (state: S) => Iterable<{ next: S; edge: E }>,
  key: (state: S) => string,
): Generator<BfsStep<S, E>>;
export function* bfs<S, E>(
  starts: Iterable<S>,
  neighbours: (state: S) => Iterable<{ next: S; edge: E }>,
  // Identity default for the string overload. TypeScript can't express
  // "default applies only when S = string", so this cast bridges the
  // generic implementation signature to the public overloads — which
  // guarantee `key` is omitted only when S = string at the call site.
  key: (state: S) => string = (state) => state as unknown as string,
): Generator<BfsStep<S, E>> {
  // Queue entries carry the state alongside its key so we don't recompute
  // key() twice per visit (once on dedup, once on parent lookup). Composite
  // keys can be non-trivial to compute; string-overload callers pay nothing
  // since key() is identity there.
  interface Entry {
    readonly state: S;
    readonly key: string;
  }
  const visited = new Set<string>();
  const parentMap = new Map<string, { parent: S; edge: E }>();
  const queue = new Queue<Entry>();
  for (const start of starts) {
    const k = key(start);
    if (!visited.has(k)) {
      visited.add(k);
      queue.push({ state: start, key: k });
    }
  }
  while (!queue.isEmpty) {
    const { state: current, key: curKey } = queue.shift();
    const parentInfo = parentMap.get(curKey);
    yield {
      state: current,
      parent: parentInfo?.parent ?? null,
      incomingEdge: parentInfo?.edge ?? null,
    };

    for (const { next, edge } of neighbours(current)) {
      const k = key(next);
      if (!visited.has(k)) {
        visited.add(k);
        parentMap.set(k, { parent: current, edge });
        queue.push({ state: next, key: k });
      }
    }
  }
}
