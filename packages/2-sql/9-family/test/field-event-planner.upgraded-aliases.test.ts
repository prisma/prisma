import { createDataTypeLookup } from '@internal/framework-components/codec';
import { sqlDataType } from '@internal/sql-contract/data-type';
import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { planFieldEventOperations } from '../src/core/migrations/field-event-planner';
import type { CodecControlHooks } from '../src/core/migrations/types';
import { col, contract, makeOp, recordingHook, table } from './field-event-fixtures';

const numeric = sqlDataType('t/numeric', {
  params: type({ 'precision?': 'number', 'scale?': 'number' }),
  read: (json) => json,
  texts: [
    { text: 'numeric', written: true, catalog: true },
    { text: 'numeric({precision},{scale})', written: true, catalog: true },
  ],
});

function events(
  prior: ReturnType<typeof contract>,
  next: ReturnType<typeof contract>,
): readonly string[] {
  const hook = recordingHook([makeOp('rotate')]);
  planFieldEventOperations({
    priorContract: prior,
    newContract: next,
    codecHooks: new Map<string, CodecControlHooks>([
      ['t/numeric@1', hook.hook],
      ['pg/text@1', hook.hook],
    ]),
    tableRenames: [],
    columnRenames: [],
    dataTypes: createDataTypeLookup([numeric]),
  });
  return hook.calls.map((call) => `${call.event} ${call.tableName}.${call.fieldName}`);
}

describe('planFieldEventOperations on a snapshot upgraded from type aliases', () => {
  // A snapshot whose `price` column was typed by `Amount = Numeric(10, 2)` and whose `note` column by `Note = Text`, after the upgrade script wrote each alias's params onto the column and removed the aliases from `storage.types`.
  const upgradedSnapshot = contract({
    Sale: table({
      price: col({
        codecId: 't/numeric@1',
        dataType: numeric.id,
        typeParams: { precision: 10, scale: 2 },
      }),
      note: col({ codecId: 'pg/text@1' }),
    }),
  });

  it('plans no field events against the contract re-emitted from the same schema', () => {
    const reEmitted = contract({
      Sale: table({
        price: col({
          codecId: 't/numeric@1',
          dataType: numeric.id,
          typeParams: { scale: 2, precision: 10 },
        }),
        note: col({ codecId: 'pg/text@1' }),
      }),
    });

    expect(events(upgradedSnapshot, reEmitted)).toEqual([]);
  });

  it("fires 'altered' when the re-emitted contract changes the alias's params", () => {
    const reEmitted = contract({
      Sale: table({
        price: col({
          codecId: 't/numeric@1',
          dataType: numeric.id,
          typeParams: { precision: 12, scale: 2 },
        }),
        note: col({ codecId: 'pg/text@1' }),
      }),
    });

    expect(events(upgradedSnapshot, reEmitted)).toEqual(['altered Sale.price']);
  });
});
