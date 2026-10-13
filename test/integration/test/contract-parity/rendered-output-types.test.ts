/**
 * The parity type test compares a defineContract contract's field types with the emitted ones only for the columns its fixtures declare. A codec whose `renderOutputType` refines the output type by the column's type parameters is typed for a defineContract contract by a separate declaration in its pack, so each such codec has to appear in a fixture with type parameters, or a disagreement between the two goes unnoticed.
 */
import { readFileSync } from 'node:fs';
import arktypeJsonPack from '@internal/extension-arktype-json/pack';
import paradedbPack from '@internal/extension-paradedb/pack';
import pgvectorPack from '@internal/extension-pgvector/pack';
import postgisPack from '@internal/extension-postgis/pack';
import { assembleDataTypes } from '@internal/framework-components/codec';
import { assemblePostgresCodecRegistryWithBuiltins } from '@internal/target-postgres/codecs';
import postgresPack from '@internal/target-postgres/pack';
import { createSqliteCodecRegistryWithBuiltins } from '@internal/target-sqlite/codecs';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

const fixtureContracts = [
  '../planner-golden/fixtures/postgres/generated/contract.json',
  '../planner-golden/fixtures/sqlite/generated/contract.json',
  '../sql-builder/fixtures/generated-no-pgvector/contract.json',
  './fixtures/postgres/generated/contract.json',
  './fixtures/sqlite/generated/contract.json',
];

type StoredColumn = { readonly codecId: string; readonly typeParams?: Record<string, unknown> };

function columnsOf(contractPath: string): readonly StoredColumn[] {
  const contract: {
    readonly storage: {
      readonly namespaces: Record<
        string,
        {
          readonly entries: {
            readonly table?: Record<string, { readonly columns: Record<string, StoredColumn> }>;
          };
        }
      >;
    };
  } = JSON.parse(readFileSync(join(import.meta.dirname, contractPath), 'utf8'));
  return Object.values(contract.storage.namespaces).flatMap((namespace) =>
    Object.values(namespace.entries.table ?? {}).flatMap((table) => Object.values(table.columns)),
  );
}

function codecsWithTypeParams(): ReadonlySet<string> {
  return new Set(
    fixtureContracts
      .flatMap(columnsOf)
      .filter((column) => Object.keys(column.typeParams ?? {}).length > 0)
      .map((column) => column.codecId),
  );
}

function codecsRenderingOutputTypes(
  descriptors: Iterable<{ readonly codecId: string; readonly renderOutputType?: unknown }>,
): readonly string[] {
  return Array.from(descriptors)
    .filter((descriptor) => typeof descriptor.renderOutputType === 'function')
    .map((descriptor) => descriptor.codecId)
    .sort();
}

const postgresExtensions = [pgvectorPack, postgisPack, paradedbPack, arktypeJsonPack];
const postgresRegistry = assemblePostgresCodecRegistryWithBuiltins(
  postgresExtensions,
  assembleDataTypes([postgresPack, ...postgresExtensions]).lookup,
);
const sqliteRegistry = createSqliteCodecRegistryWithBuiltins();

describe('every codec that renders its output type from type parameters is in a parity fixture', () => {
  it('finds the codecs, so the check is not empty', () => {
    expect(codecsRenderingOutputTypes(postgresRegistry.values())).toContain('pg/vector@1');
    expect(codecsWithTypeParams()).toContain('sql/char@1');
  });

  it('Postgres and its extensions', () => {
    const exercised = codecsWithTypeParams();
    expect(
      codecsRenderingOutputTypes(postgresRegistry.values()).filter((id) => !exercised.has(id)),
    ).toEqual([]);
  });

  it('SQLite', () => {
    const exercised = codecsWithTypeParams();
    expect(
      codecsRenderingOutputTypes(sqliteRegistry.values()).filter((id) => !exercised.has(id)),
    ).toEqual([]);
  });
});
