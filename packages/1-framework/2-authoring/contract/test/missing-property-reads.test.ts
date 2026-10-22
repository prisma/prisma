import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { answerMissingPropertyReads } from '../src/missing-property-reads';

function guarded() {
  const reads: string[] = [];
  const helpers = answerMissingPropertyReads({ column: () => 'column' }, (name) => {
    reads.push(name);
    throw new Error(`no ${name}`);
  });
  return { helpers, reads };
}

describe('answerMissingPropertyReads', () => {
  it('answers a read of a property the object does not have', () => {
    const { helpers } = guarded();
    expect(() => Reflect.get(helpers, 'text')).toThrow('no text');
  });

  it('leaves the object and its own properties as they were', () => {
    const { helpers, reads } = guarded();
    expect([
      helpers.column(),
      Object.keys(helpers),
      'column' in helpers,
      'text' in helpers,
    ]).toEqual(['column', ['column'], true, false]);
    expect(reads).toEqual([]);
  });

  it('keeps symbol reads, then, toJSON, the Object.prototype methods and inspection working', () => {
    const { helpers, reads } = guarded();
    expect([
      Reflect.get(helpers, Symbol.iterator),
      Reflect.get(helpers, 'then'),
      Reflect.get(helpers, 'toJSON'),
      Object.hasOwn(helpers, 'column'),
      String(helpers),
      JSON.stringify(helpers),
      inspect(helpers),
    ]).toEqual([
      undefined,
      undefined,
      undefined,
      true,
      '[object Object]',
      '{}',
      '{ column: [Function: column] }',
    ]);
    expect(reads).toEqual([]);
  });

  it('can be awaited and compared', async () => {
    const { helpers, reads } = guarded();
    expect(await Promise.resolve(helpers)).toBe(helpers);
    expect(helpers).toEqual(helpers);
    expect(helpers).toHaveProperty('column');
    expect(reads).toEqual([]);
  });
});
