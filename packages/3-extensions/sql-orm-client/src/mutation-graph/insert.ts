import type { InsertAst, ProjectionItem } from '@internal/sql-relational-core/ast';
import { withColumns } from './filtered-statement';
import { type Executed, Node, type OutputsOf, type Run } from './node';
import type { PayloadData } from './payload-data';
import { executeStatement, rowsResult } from './run-statement';

type Payloads = { payload: PayloadData[] };

export class Insert extends Node<Payloads> {
  readonly ast: InsertAst;

  constructor(ast: InsertAst) {
    super();
    this.ast = ast;
    Object.freeze(this);
  }

  get returns(): readonly ProjectionItem[] {
    return this.ast.returning ?? [];
  }

  override execute(inputs: OutputsOf<Payloads>, run: Run): Executed {
    if (inputs.payload === null) {
      return executeStatement(this.ast, run);
    }
    if (inputs.payload.some((records) => records.length === 0)) {
      return rowsResult([]);
    }
    const payload = Object.assign({}, ...inputs.payload.map(([record]) => record));
    const rows = this.ast.rows.map((row) => ({ ...row, ...payload }));
    return executeStatement(this.ast.withRows(rows), run);
  }

  override withReturning(columns: readonly ProjectionItem[]): Insert {
    return new Insert(this.ast.withReturning(withColumns(this.returns, columns)));
  }
}
