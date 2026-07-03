import { expect, test } from 'vitest'

import type { CompactedBatchResponse } from './batch'
import { convertCompactedRows } from './batch'

test('resolves compact query-plan placeholders when matching compacted rows', () => {
  const compiledBatch = {
    type: 'compacted',
    plan: ['0'],
    arguments: [{ id: { $p: ['%1', 'Int'] } }, { id: { $p: ['%2', 'Int'] } }, { id: 100 }],
    nestedSelection: ['name'],
    keys: ['id'],
    expectNonEmpty: false,
  } satisfies CompactedBatchResponse

  expect(
    convertCompactedRows(
      [
        { id: 42, name: 'Alice' },
        { id: 43, name: 'Bob' },
      ],
      compiledBatch,
      { '%1': 42, '%2': 43 },
    ),
  ).toEqual([{ name: 'Alice' }, { name: 'Bob' }, null])
})
