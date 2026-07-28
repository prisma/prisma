import type { CodecRegistry } from '@prisma-next/framework-components/codec';
import type { StorageColumn, StorageTable } from '@prisma-next/sql-contract/types';
import type {
  AnyQueryAst,
  BinaryExpr,
  ColumnRef,
  DefaultValueExpr,
  DeleteAst,
  Direction,
  InsertAst,
  JoinAst,
  LiteralExpr,
  LoweredStatement,
  OperationExpr,
  ParamRef,
  SelectAst,
  UpdateAst,
} from '@prisma-next/sql-relational-core/ast';
import type {
  AnyPostgresCodecDescriptor,
  PostgresCodecDescriptorRegistry,
} from '@prisma-next/target-postgres/codec-descriptor';

export type PostgresCodecRegistry = CodecRegistry & PostgresCodecDescriptorRegistry;

export interface PostgresAdapterOptions {
  readonly profileId?: string;
  /**
   * Custom PostgreSQL codec descriptors contributed alongside the built-ins.
   * The complete descriptor set is validated at construction and becomes the
   * single source for both codec materialization and target-specific lowering.
   */
  readonly codecDescriptors?: readonly AnyPostgresCodecDescriptor[];
}

export type { PostgresContract } from '@prisma-next/target-postgres/types';

export type Expr = ColumnRef | ParamRef | DefaultValueExpr;

export interface OrderClause {
  readonly expr: ColumnRef;
  readonly dir: Direction;
}

export type PostgresLoweredStatement = LoweredStatement;

export type {
  AnyQueryAst,
  BinaryExpr,
  ColumnRef,
  DefaultValueExpr,
  DeleteAst,
  Direction,
  InsertAst,
  JoinAst,
  LiteralExpr,
  OperationExpr,
  ParamRef,
  SelectAst,
  StorageColumn,
  StorageTable,
  UpdateAst,
};
