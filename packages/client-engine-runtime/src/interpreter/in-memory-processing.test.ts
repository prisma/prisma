import { expect, test } from 'vitest'

import { InMemoryOps } from '../query-plan'
import { processRecords } from './in-memory-processing'

test('treats omitted in-memory ops defaults as empty', () => {
  const records = [
    {
      id: 1,
      posts: [
        { id: 1, title: 'one' },
        { id: 2, title: 'two' },
      ],
    },
  ]

  expect(processRecords(structuredClone(records), {} satisfies InMemoryOps)).toEqual(records)
})

test('supports compact pagination without explicit null fields', () => {
  expect(
    processRecords(
      [
        { id: 1, title: 'one' },
        { id: 2, title: 'two' },
        { id: 3, title: 'three' },
      ],
      {
        pagination: {
          skip: 1,
          take: 1,
        },
      } satisfies InMemoryOps,
    ),
  ).toEqual([{ id: 2, title: 'two' }])
})

test('supports compact nested pagination without explicit parent defaults', () => {
  expect(
    processRecords(
      [
        {
          id: 1,
          posts: [
            { id: 1, title: 'one' },
            { id: 2, title: 'two' },
            { id: 3, title: 'three' },
          ],
        },
      ],
      {
        nested: {
          posts: {
            pagination: {
              take: 2,
            },
          },
        },
      } satisfies InMemoryOps,
    ),
  ).toEqual([
    {
      id: 1,
      posts: [
        { id: 1, title: 'one' },
        { id: 2, title: 'two' },
      ],
    },
  ])
})
