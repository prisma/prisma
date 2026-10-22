import { readFileSync, writeFileSync } from 'node:fs';
import type { Contract } from '@internal/contract/types';
import { timeouts } from '@repo/test-utils';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';
import {
  emitMongo,
  emitPostgres,
  emitSqlite,
  type Form,
  interpretMongo,
  interpretPostgres,
  interpretSqlite,
  mongoSchema,
  mongoTs,
  postgresTs,
  sqliteTs,
  sqlSchema,
} from './preset-replacement-contracts';
import {
  mongoRows,
  type PresetReplacementRow,
  postgresRows,
  sqliteRows,
} from './preset-replacement-rows';

const updateExpected = process.env['UPDATE_PRESET_REPLACEMENTS_EXPECTED'] === '1';

interface TargetCase<Row> {
  readonly target: 'postgres' | 'sqlite' | 'mongo';
  readonly rows: readonly Row[];
  readonly psl: (rows: readonly Row[], form: Form) => Contract;
  readonly ts: (rows: readonly Row[], form: Form) => Contract;
  readonly emit: (contract: Contract) => Promise<string>;
}

async function emitted<Row>(
  targetCase: TargetCase<Row>,
  surface: 'psl' | 'ts',
  rows: readonly Row[],
  form: Form,
): Promise<unknown> {
  return JSON.parse(await targetCase.emit(targetCase[surface](rows, form)));
}

function describeTarget<Row extends PresetReplacementRow<never, unknown>>(
  targetCase: TargetCase<Row>,
): void {
  describe(`on ${targetCase.target}`, () => {
    describe.each(targetCase.rows.map((row) => [row.model, row] as const))('%s', (_, row) => {
      it.runIf(row.psl.preset !== undefined)(
        `PSL ${row.psl.replacement} stores what ${row.psl.preset} stores`,
        async () => {
          expect(await emitted(targetCase, 'psl', [row], 'replacement')).toEqual(
            await emitted(targetCase, 'psl', [row], 'preset'),
          );
        },
      );

      it('the TypeScript replacement stores what the TypeScript preset stores', async () => {
        expect(await emitted(targetCase, 'ts', [row], 'replacement')).toEqual(
          await emitted(targetCase, 'ts', [row], 'preset'),
        );
      });

      it('the TypeScript replacement stores what the PSL replacement stores', async () => {
        expect(await emitted(targetCase, 'ts', [row], 'replacement')).toEqual(
          await emitted(targetCase, 'psl', [row], 'replacement'),
        );
      });
    });

    it(
      'emits the committed contract from the replacements',
      async () => {
        const expectedPath = join(
          import.meta.dirname,
          'expected',
          `${targetCase.target}.contract.json`,
        );
        const fromPsl = await targetCase.emit(targetCase.psl(targetCase.rows, 'replacement'));
        if (updateExpected) writeFileSync(expectedPath, `${fromPsl}\n`, 'utf-8');
        const expected = JSON.parse(readFileSync(expectedPath, 'utf-8'));
        expect({
          psl: JSON.parse(fromPsl),
          ts: await emitted(targetCase, 'ts', targetCase.rows, 'replacement'),
        }).toEqual({ psl: expected, ts: expected });
      },
      timeouts.typeScriptCompilation,
    );
  });
}

describe('every removed field preset and its replacement', () => {
  describeTarget({
    target: 'postgres',
    rows: postgresRows,
    psl: (rows, form) => interpretPostgres(sqlSchema(rows, form)),
    ts: postgresTs,
    emit: emitPostgres,
  });
  describeTarget({
    target: 'sqlite',
    rows: sqliteRows,
    psl: (rows, form) => interpretSqlite(sqlSchema(rows, form)),
    ts: sqliteTs,
    emit: emitSqlite,
  });
  describeTarget({
    target: 'mongo',
    rows: mongoRows,
    psl: (rows, form) => interpretMongo(mongoSchema(rows, form)),
    ts: mongoTs,
    emit: emitMongo,
  });
});
