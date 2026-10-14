import type { ProjectionItem } from '@internal/sql-relational-core/ast';
import { type Executed, Node, type OutputsOf, type Run } from './node';
import type { Rows } from './rows';
import { rowsResult } from './run-statement';

type Inputs = { rows: Rows[] };

export class ConcatRows extends Node<Inputs> {
  constructor() {
    super();
    Object.freeze(this);
  }

  get returns(): readonly ProjectionItem[] {
    return [];
  }

  override execute(inputs: OutputsOf<Inputs>, _run: Run): Executed {
    return rowsResult((inputs.rows ?? []).flat());
  }

  override withReturning(_columns: readonly ProjectionItem[]): ConcatRows {
    return this;
  }
}
