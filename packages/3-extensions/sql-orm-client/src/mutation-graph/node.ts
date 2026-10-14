import type { AsyncIterableResult } from '@internal/framework-components/runtime';
import type {
  DeleteAst,
  InsertAst,
  ProjectionItem,
  SelectAst,
  UpdateAst,
} from '@internal/sql-relational-core/ast';
import type { Edge, StorageRow } from './edge';

export type StatementAst = SelectAst | InsertAst | UpdateAst | DeleteAst;

export type Slots = Record<string, Edge<unknown>[]>;

type OutputOf<E> = E extends Edge<infer Output> ? Output : never;

export type OutputsOf<Inputs extends Slots> = {
  readonly [Slot in keyof Inputs]: readonly (readonly OutputOf<Inputs[Slot][number]>[])[] | null;
};

export type Executed = AsyncIterableResult<StorageRow> | Promise<number>;

export interface Run {
  query(ast: StatementAst): AsyncIterableResult<StorageRow>;
  execute(ast: StatementAst): Promise<number>;
}

export abstract class Node<Inputs extends Slots = Slots> {
  abstract readonly returns: readonly ProjectionItem[];

  abstract execute(inputs: OutputsOf<Inputs>, run: Run): Executed;

  abstract withReturning(columns: readonly ProjectionItem[]): Node<Inputs>;
}
