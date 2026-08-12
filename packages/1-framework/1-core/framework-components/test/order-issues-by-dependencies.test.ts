import { describe, expect, it } from 'vitest';
import { orderIssuesByDependencies } from '../src/control/order-issues-by-dependencies';
import type { DiffableNode, SchemaDiffIssue } from '../src/control/schema-diff';

/**
 * The ordering helper reads only an issue's `path`, `dependsOn`, and the
 * presence of `expected` (build-up) vs `actual`-only (tear-down). A minimal
 * node satisfies the type; its contents are never inspected.
 */
const NODE: DiffableNode = {
  id: 'node',
  nodeKind: 'node',
  isEqualTo: () => true,
  children: () => [],
};

/** A create/alter issue at `path` — `expected` present makes it an "up" issue. */
function up(path: readonly string[], dependsOn?: readonly (readonly string[])[]): SchemaDiffIssue {
  return {
    path,
    expected: NODE,
    ...(dependsOn !== undefined ? { dependsOn } : {}),
  };
}

/** A pure-drop issue at `path` — only `actual` present makes it a "down" issue. */
function down(
  path: readonly string[],
  dependsOn?: readonly (readonly string[])[],
): SchemaDiffIssue {
  return {
    path,
    actual: NODE,
    ...(dependsOn !== undefined ? { dependsOn } : {}),
  };
}

function orderedPaths(issues: readonly SchemaDiffIssue[]): string[] {
  return orderIssuesByDependencies(issues).map((issue) => issue.path.join('/'));
}

function positionOf(order: readonly string[], path: string): number {
  const index = order.indexOf(path);
  if (index === -1) throw new Error(`path not in order: ${path}`);
  return index;
}

describe('orderIssuesByDependencies', () => {
  it('returns the input unchanged when there are 0 or 1 issues', () => {
    expect(orderIssuesByDependencies([])).toEqual([]);
    const one = [up(['database', 'a'])];
    expect(orderIssuesByDependencies(one)).toBe(one);
  });

  it('create-from-empty: independent issues come out in stable path order', () => {
    const order = orderedPaths([
      up(['database', 'z']),
      up(['database', 'a']),
      up(['database', 'm']),
    ]);
    expect(order).toEqual(['database/a', 'database/m', 'database/z']);
  });

  it('cross-table FK pair (mutual A↔B) stays acyclic; both tables precede both FKs', () => {
    const tableA = up(['database', 's', 'a']);
    const tableB = up(['database', 's', 'b']);
    const fkA = up(['database', 's', 'a', 'fk:a-to-b'], [['database', 's', 'b']]);
    const fkB = up(['database', 's', 'b', 'fk:b-to-a'], [['database', 's', 'a']]);
    const order = orderedPaths([fkA, fkB, tableA, tableB]);
    const lastTable = Math.max(
      positionOf(order, 'database/s/a'),
      positionOf(order, 'database/s/b'),
    );
    const firstFk = Math.min(
      positionOf(order, 'database/s/a/fk:a-to-b'),
      positionOf(order, 'database/s/b/fk:b-to-a'),
    );
    expect(lastTable).toBeLessThan(firstFk);
  });

  it('the way up: a dependency precedes its dependent', () => {
    // fk depends on the referenced table; both created → table first.
    const table = up(['database', 's', 'user']);
    const fk = up(['database', 's', 'post', 'fk:post-user'], [['database', 's', 'user']]);
    const order = orderedPaths([fk, table]);
    expect(positionOf(order, 'database/s/user')).toBeLessThan(
      positionOf(order, 'database/s/post/fk:post-user'),
    );
  });

  it('the way down: a dependent precedes the dependency it needs (edge reverses)', () => {
    // fk depends on the referenced table; both dropped → drop the fk first.
    const table = down(['database', 's', 'user']);
    const fk = down(['database', 's', 'post', 'fk:post-user'], [['database', 's', 'user']]);
    const order = orderedPaths([table, fk]);
    expect(positionOf(order, 'database/s/post/fk:post-user')).toBeLessThan(
      positionOf(order, 'database/s/user'),
    );
  });

  it('own-column edge up: a column-backed object follows the column it is built on', () => {
    // A unique/index/fk on `total`, created alongside the column → column first.
    const column = up(['database', 's', 'orders', 'column:total']);
    const index = up(
      ['database', 's', 'orders', 'index:total'],
      [['database', 's', 'orders', 'column:total']],
    );
    const order = orderedPaths([index, column]);
    expect(positionOf(order, 'database/s/orders/column:total')).toBeLessThan(
      positionOf(order, 'database/s/orders/index:total'),
    );
  });

  it('own-column edge down: a column-backed object is dropped before its column', () => {
    // Dropping the column auto-drops the object, so the object drops first.
    const column = down(['database', 's', 'orders', 'column:total']);
    const index = down(
      ['database', 's', 'orders', 'index:total'],
      [['database', 's', 'orders', 'column:total']],
    );
    const order = orderedPaths([column, index]);
    expect(positionOf(order, 'database/s/orders/index:total')).toBeLessThan(
      positionOf(order, 'database/s/orders/column:total'),
    );
  });

  it('containment on the way up: a parent entity precedes its contained child', () => {
    const table = up(['database', 's', 'orders']); // an altered table (has expected)
    const column = up(['database', 's', 'orders', 'column:total']);
    const order = orderedPaths([column, table]);
    expect(positionOf(order, 'database/s/orders')).toBeLessThan(
      positionOf(order, 'database/s/orders/column:total'),
    );
  });

  it('containment on the way down: a contained child is removed before its parent', () => {
    const table = down(['database', 's', 'orders']);
    const column = down(['database', 's', 'orders', 'column:total']);
    const order = orderedPaths([table, column]);
    expect(positionOf(order, 'database/s/orders/column:total')).toBeLessThan(
      positionOf(order, 'database/s/orders'),
    );
  });

  it('policy + role: a policy follows both the table and the roles it depends on', () => {
    const table = up(['database', 's', 'profiles']);
    const role = up(['database', 'app_user']);
    const policy = up(
      ['database', 's', 'profiles', 'policy:read_own'],
      [
        ['database', 's', 'profiles'],
        ['database', 'app_user'],
      ],
    );
    const order = orderedPaths([policy, role, table]);
    const policyAt = positionOf(order, 'database/s/profiles/policy:read_own');
    expect(positionOf(order, 'database/s/profiles')).toBeLessThan(policyAt);
    expect(positionOf(order, 'database/app_user')).toBeLessThan(policyAt);
  });

  it('drops a dependsOn ref whose target produced no issue (satisfied by reality)', () => {
    // fk depends on a table that is NOT in the diff — no edge, no throw.
    const fk = up(['database', 's', 'post', 'fk:post-user'], [['database', 's', 'user']]);
    const other = up(['database', 's', 'a']);
    expect(orderedPaths([fk, other])).toEqual(['database/s/a', 'database/s/post/fk:post-user']);
  });

  it('identical input yields identical output; input order does not matter (determinism)', () => {
    const build = (): SchemaDiffIssue[] => [
      up(['database', 's', 'user']),
      up(['database', 's', 'post']),
      up(['database', 's', 'post', 'fk:post-user'], [['database', 's', 'user']]),
      down(['database', 's', 'legacy']),
      up(['database', 's', 'audit']),
    ];
    const baseline = orderedPaths(build());
    expect(orderedPaths(build())).toEqual(baseline);
    // A shuffled permutation of the same issues produces the same order.
    const shuffled = build();
    shuffled.reverse();
    expect(orderedPaths(shuffled)).toEqual(baseline);
  });

  it('throws on a dependency cycle, naming the unresolved issues', () => {
    const a = up(['database', 's', 'a'], [['database', 's', 'b']]);
    const b = up(['database', 's', 'b'], [['database', 's', 'a']]);
    expect(() => orderIssuesByDependencies([a, b])).toThrow(/dependency cycle/i);
    expect(() => orderIssuesByDependencies([a, b])).toThrow(/database\/s\/a/);
  });
});
