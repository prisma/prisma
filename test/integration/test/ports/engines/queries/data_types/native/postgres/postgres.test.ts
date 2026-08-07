import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../../_harness/postgres';
import type { Contract } from './_fixture/other/generated/contract';
import contractJson from './_fixture/other/generated/contract.json' with { type: 'json' };

describe('ports/engines/queries/data_types/native/postgres', () => {
  it(
    'native_other_types',
    () =>
      withPostgresPort<Contract>({ contractJson }, async ({ db }) => {
        await db.public.Child.create({
          id: 1,
          bool: true,
          byteA: Uint8Array.from(Buffer.from('dGVzdA==', 'base64')),
          json: {},
          jsonb: { a: 'b' },
        });
        await db.public.Parent.create({ id: 1, childId: 1 });

        const result = await db.public.Parent.include('child', (child) =>
          child.select('id', 'bool', 'byteA', 'json', 'jsonb'),
        )
          .select('id')
          .all();
        expect(result).toEqual([
          {
            id: 1,
            child: {
              id: 1,
              bool: true,
              byteA: Uint8Array.from(Buffer.from('dGVzdA==', 'base64')),
              json: {},
              jsonb: { a: 'b' },
            },
          },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );
});
