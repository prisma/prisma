/**
 * The recreate postchecks, run against a real SQLite database in the shape a rebuild leaves behind. They must hold for a correct rebuild and fail while a removed constraint remains.
 */

import { DatabaseSync } from 'node:sqlite';
import { sqlRawDataType } from '@internal/sql-contract/data-type';
import { SqlColumnIR } from '@internal/sql-schema-ir/types';
import { describe, expect, it } from 'vitest';
import type { SqliteTableSpec } from '../../src/core/migrations/operations/shared';
import { buildRecreatePostchecks } from '../../src/core/migrations/operations/tables';
import { actualColumn, expectedColumn, issue, unique } from './node-issue-helpers';

const codesSpec: SqliteTableSpec = {
  columns: [
    { name: 'code', typeSql: 'TEXT', nullable: false },
    { name: 'label', typeSql: 'TEXT', nullable: false },
  ],
  primaryKey: { columns: ['code'] },
  uniques: [{ columns: ['code'] }],
  foreignKeys: [],
};

const uniqueIssues = [
  issue({ path: ['database', 'codes', 'unique:code'], expected: unique(['code']) }),
];

function postcheckResults(createTableSql: string): Record<string, boolean> {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(createTableSql);
    return Object.fromEntries(
      buildRecreatePostchecks('codes', uniqueIssues, codesSpec).map((check) => {
        if (!('sql' in check)) {
          throw new Error(`postcheck "${check.description}" carries no SQL to run`);
        }
        return [check.description, Object.values(db.prepare(check.sql).get() ?? {})[0] === 1];
      }),
    );
  } finally {
    db.close();
  }
}

describe('buildRecreatePostchecks on SQLite', () => {
  it('holds after a rebuild whose unique constraint repeats a text primary key', () => {
    const results = postcheckResults(
      'CREATE TABLE "codes" ("code" TEXT NOT NULL, "label" TEXT NOT NULL, PRIMARY KEY ("code"), UNIQUE ("code"))',
    );

    expect(Object.values(results)).toEqual(Object.values(results).map(() => true));
    expect(Object.keys(results).length).toBeGreaterThan(1);
  });

  it('fails while a unique constraint the rebuild removes is still there', () => {
    const results = postcheckResults(
      'CREATE TABLE "codes" ("code" TEXT NOT NULL, "label" TEXT NOT NULL, PRIMARY KEY ("code"), UNIQUE ("code"), UNIQUE ("label"))',
    );

    expect(Object.values(results)).toContain(false);
  });
});

function typePostcheckHolds(
  declaredType: string,
  column: { readonly typeSql: string; readonly expected: SqlColumnIR },
): boolean {
  const spec: SqliteTableSpec = {
    columns: [{ name: 'shape', typeSql: column.typeSql, nullable: true }],
    uniques: [],
    foreignKeys: [],
  };
  const issues = [
    issue({
      path: ['database', 'places', 'column:shape'],
      expected: column.expected,
      actual: actualColumn({ name: 'shape', nativeType: 'blob', nullable: true }),
    }),
  ];
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE "places" ("shape" ${declaredType})`);
    const [check] = buildRecreatePostchecks('places', issues, spec);
    if (check === undefined || !('sql' in check)) {
      throw new Error('expected one type postcheck carrying SQL');
    }
    return Object.values(db.prepare(check.sql).get() ?? {})[0] === 1;
  } finally {
    db.close();
  }
}

describe('the type postcheck of a recreated table', () => {
  const rawCircle = {
    typeSql: 'circle',
    expected: new SqlColumnIR({
      name: 'shape',
      nativeType: 'circle',
      nullable: true,
      resolvedNativeType: 'circle',
      dataType: sqlRawDataType,
    }),
  };
  const integer = {
    typeSql: 'INTEGER',
    expected: expectedColumn({ name: 'shape', nativeType: 'integer', nullable: true }),
  };

  it('compares a type named by its catalog text exactly, case included, as verify does', () => {
    expect({
      exact: typePostcheckHolds('circle', rawCircle),
      otherCase: typePostcheckHolds('CIRCLE', rawCircle),
    }).toEqual({ exact: true, otherCase: false });
  });

  it('compares any other type without case', () => {
    expect({
      upper: typePostcheckHolds('INTEGER', integer),
      lower: typePostcheckHolds('integer', integer),
    }).toEqual({ upper: true, lower: true });
  });
});
