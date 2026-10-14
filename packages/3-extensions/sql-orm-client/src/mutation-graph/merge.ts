import type { ProjectionItem } from '@internal/sql-relational-core/ast';
import { variantColumnLabel } from '../collection-tables';
import type { AliasedTable } from '../table-scope';
import type { StorageRow } from './edge';
import { type Executed, Node, type OutputsOf, type Run } from './node';
import type { Rows } from './rows';
import { rowsResult } from './run-statement';

type BaseAndVariant = { base: Rows[]; variant: Rows[] };

export class Merge extends Node<BaseAndVariant> {
  readonly variantTable: AliasedTable;
  readonly keyColumns: readonly string[];

  constructor(variantTable: AliasedTable, keyColumns: readonly string[]) {
    super();
    this.variantTable = variantTable;
    this.keyColumns = Object.freeze([...keyColumns]);
    Object.freeze(this);
  }

  get returns(): readonly ProjectionItem[] {
    return [];
  }

  override execute(inputs: OutputsOf<BaseAndVariant>, _run: Run): Executed {
    const [base] = (inputs.base ?? []).flat();
    const [variant] = (inputs.variant ?? []).flat();
    if (base === undefined || variant === undefined) {
      return rowsResult([]);
    }
    return rowsResult([{ ...base, ...this.#labelled(variant) }]);
  }

  override withReturning(_columns: readonly ProjectionItem[]): Merge {
    return this;
  }

  #labelled(variant: StorageRow): StorageRow {
    return Object.fromEntries(
      Object.entries(variant)
        .filter(([column]) => !this.keyColumns.includes(column))
        .map(([column, value]) => [variantColumnLabel(this.variantTable, column), value]),
    );
  }
}
