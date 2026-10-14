import { describe, expect, it } from 'vitest';
import { createCollectionTables } from '../../src/collection-tables';
import { createVariantGraph } from '../../src/mutation-graph/collection-graphs';
import { emptyState } from '../../src/types';
import { buildMixedPolyContract, buildTestContextFromContract } from '../helpers';
import { printGraph } from './print-graph';
import { returnedAt } from './statements';

const contract = buildMixedPolyContract();
const tables = createCollectionTables(contract, 'public', 'Task');
const features = tables.variants.get('feature');
if (features === undefined) {
  throw new Error('the fixture has an MTI variant feature');
}
const collection = {
  context: buildTestContextFromContract(contract),
  state: { ...emptyState(tables), variantValue: 'feature' },
  modelName: 'Task',
  namespaceId: 'public',
};
const darkMode = { base: { title: 'Dark mode', type: 'feature' }, variant: { priority: 1 } };
const exportPdf = { base: { title: 'Export to PDF', type: 'feature' }, variant: { priority: 3 } };

describe('createVariantGraph', () => {
  it('builds no node for no rows', () => {
    expect(printGraph(createVariantGraph(collection, features, 'Feature', []))).toBe(
      'result: none',
    );
  });

  it('inserts the base row, then the variant row with its key, and merges them for one row', () => {
    const graph = createVariantGraph(collection, features, 'Feature', [darkMode]);

    expect(printGraph(graph)).toBe(
      [
        'n1 Insert tasks',
        'n2 Insert features <- PayloadData n1 (id->id)',
        'n3 Merge <- Rows n1, Rows n2',
        'result: n3',
      ].join('\n'),
    );
    expect(returnedAt(graph, 1)).toEqual(['features__priority', 'features__assignee_id']);
  });

  it('joins the merged rows of several rows one after another', () => {
    const graph = createVariantGraph(collection, features, 'Feature', [darkMode, exportPdf]);

    expect(printGraph(graph)).toBe(
      [
        'n1 Insert tasks',
        'n2 Insert features <- PayloadData n1 (id->id)',
        'n3 Merge <- Rows n1, Rows n2',
        'n4 Insert tasks',
        'n5 Insert features <- PayloadData n4 (id->id)',
        'n6 Merge <- Rows n4, Rows n5',
        'n7 ConcatRows <- Rows n3, Rows n6',
        'result: n7',
      ].join('\n'),
    );
  });
});
