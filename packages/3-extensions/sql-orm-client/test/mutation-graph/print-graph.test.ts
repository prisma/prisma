import { describe, expect, it } from 'vitest';
import { FilterData } from '../../src/mutation-graph/filter-data';
import { Graph } from '../../src/mutation-graph/graph';
import { printGraph } from './print-graph';
import {
  columnPairs,
  deletePosts,
  deleteUsers,
  findUsers,
  nameIsAda,
  updateUsers,
} from './statements';

describe('printGraph', () => {
  it('prints one node and the result that names it', () => {
    const graph = new Graph();
    graph.setResult(
      graph.add(updateUsers({ email: 'ada@example.com' }, nameIsAda), { filter: [] }),
    );

    expect(printGraph(graph)).toBe(
      ["n1 Update users set email = 'ada@example.com' where name = 'Ada'", 'result: n1'].join('\n'),
    );
  });

  it('prints a FilterData edge with its column pair', () => {
    const graph = new Graph();
    const find = graph.add(findUsers([nameIsAda]), { filter: [] });
    const sameId = columnPairs('users', 'users', [['id', 'id']]);
    graph.setResult(graph.add(deleteUsers(), { filter: [new FilterData(find, sameId)] }));

    expect(printGraph(graph)).toBe(
      [
        "n1 Find users where name = 'Ada'",
        'n2 Delete users <- FilterData n1 (id->id)',
        'result: n2',
      ].join('\n'),
    );
  });

  it('prints every column pair of a FilterData edge', () => {
    const graph = new Graph();
    const find = graph.add(findUsers(), { filter: [] });
    const pairs = columnPairs('users', 'posts', [
      ['id', 'user_id'],
      ['name', 'title'],
    ]);
    graph.setResult(graph.add(deletePosts(), { filter: [new FilterData(find, pairs)] }));

    expect(printGraph(graph)).toBe(
      [
        'n1 Find users',
        'n2 Delete posts <- FilterData n1 (id->user_id, name->title)',
        'result: n2',
      ].join('\n'),
    );
  });

  it('prints every input of a node', () => {
    const graph = new Graph();
    const find = graph.add(findUsers(), { filter: [] });
    const other = graph.add(findUsers(), { filter: [] });
    const sameId = columnPairs('users', 'users', [['id', 'id']]);
    graph.add(deleteUsers(), {
      filter: [new FilterData(find, sameId), new FilterData(other, sameId)],
    });
    graph.setResult(find);

    expect(printGraph(graph)).toBe(
      [
        'n1 Find users',
        'n2 Find users',
        'n3 Delete users <- FilterData n1 (id->id), FilterData n2 (id->id)',
        'result: n1',
      ].join('\n'),
    );
  });

  it('prints none for a result with no node', () => {
    const graph = new Graph();
    graph.add(findUsers(), { filter: [] });

    expect(printGraph(new Graph())).toBe('result: none');
    expect(printGraph(graph)).toBe(['n1 Find users', 'result: none'].join('\n'));
  });
});
