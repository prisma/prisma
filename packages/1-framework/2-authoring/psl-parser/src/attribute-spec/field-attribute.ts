import type { PslDiagnostic } from '@prisma-next/framework-components/psl-ast';
import type { AstNode } from '../syntax/ast-helpers';
import type { AttributeOut, AttributeSpec, InterpretCtx, Param, PositionalParam } from './types';

interface FieldAttributeConfig<
  Pos extends readonly PositionalParam[],
  Named extends Record<string, Param<unknown>>,
> {
  readonly positional?: Pos;
  readonly named?: Named;
  readonly refine?: (
    parsed: AttributeOut<Pos, Named>,
    ctx: InterpretCtx,
    attributeNode: AstNode,
  ) => readonly PslDiagnostic[];
}

export function fieldAttribute<
  const Pos extends readonly PositionalParam[] = readonly [],
  const Named extends Record<string, Param<unknown>> = Record<never, never>,
>(name: string, config: FieldAttributeConfig<Pos, Named>): AttributeSpec<AttributeOut<Pos, Named>> {
  return {
    level: 'field',
    name,
    positional: config.positional ?? [],
    named: config.named ?? {},
    ...(config.refine !== undefined ? { refine: config.refine } : {}),
  };
}
