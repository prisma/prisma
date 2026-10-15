import { type Executed, Node, type OutputsOf, type Run } from './node';
import type { Rows } from './rows';
import { rowsResult } from './run-statement';

type Inputs = { rows: Rows[] };

export class Merge extends Node<Inputs> {
  constructor() {
    super();
    Object.freeze(this);
  }

  override execute(inputs: OutputsOf<Inputs>, _run: Run): Executed {
    const edges = inputs.rows ?? [];
    if (edges.length === 0 || edges.some((rows) => rows.length === 0)) {
      return rowsResult([]);
    }
    return rowsResult([Object.assign({}, ...edges.map(([row]) => row))]);
  }
}
