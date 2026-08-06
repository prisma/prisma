import type { PlanMeta } from '@internal/contract/types';
import type {
  AsyncIterableResult,
  RuntimeExecuteOptions,
} from '@internal/framework-components/runtime';
import type { AnyQueryAst, LoweredParam } from '@internal/sql-relational-core/ast';
import type { DecodeContext } from '../codecs/decoding';
import type { ParamMetadata } from '../codecs/encoding';
import type { RuntimeQueryable } from '../sql-runtime';
import type { ParamsFromDeclaration, PreparedStatement } from './types';

export interface PreparedStatementInternals {
  readonly sql: string;
  readonly ast: AnyQueryAst;
  readonly meta: PlanMeta;
  readonly slots: readonly LoweredParam[];
  readonly decodeContext: DecodeContext;
  readonly paramMetadata: readonly ParamMetadata[];
}

export class PreparedStatementImpl<Params, Row>
  implements PreparedStatement<Params, Row>, PreparedStatementInternals
{
  readonly sql: string;
  readonly ast: AnyQueryAst;
  readonly meta: PlanMeta;
  readonly slots: readonly LoweredParam[];
  readonly decodeContext: DecodeContext;
  readonly paramMetadata: readonly ParamMetadata[];

  constructor(internals: PreparedStatementInternals) {
    this.sql = internals.sql;
    this.ast = internals.ast;
    this.meta = internals.meta;
    this.slots = internals.slots;
    this.decodeContext = internals.decodeContext;
    this.paramMetadata = internals.paramMetadata;
    Object.freeze(this);
  }

  execute(
    target: RuntimeQueryable,
    params: Params,
    options?: RuntimeExecuteOptions,
  ): AsyncIterableResult<Row> {
    return target.queryPrepared(this, params, options);
  }
}

export type { ParamsFromDeclaration };
