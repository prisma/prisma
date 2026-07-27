import type { PslDiagnostic } from '@prisma-next/framework-components/psl-ast';
import type { Result } from '@prisma-next/utils/result';
import type { Simplify, UnionToIntersection } from '@prisma-next/utils/types';
import type { SourceFile } from '../source-file';
import type { FieldSymbol, ModelSymbol } from '../symbol-table';
import type { ExpressionAst } from '../syntax/ast/expressions';
import type { AstNode } from '../syntax/ast-helpers';

export type AttributeLevel = 'field' | 'model' | 'block';

export interface ArgType<T> {
  readonly kind: string;
  readonly label: string;
  // phantom carrier for `T`; never read at runtime.
  readonly _out?: T;
  parse(arg: ExpressionAst, ctx: InterpretCtx): Result<T, readonly PslDiagnostic[]>;
}

export interface InterpretCtx {
  readonly level: AttributeLevel;
  readonly sourceId: string;
  readonly sourceFile: SourceFile;
  readonly selfModel: ModelSymbol;
  resolveReferencedModel(): ModelSymbol | undefined;
  readonly field?: FieldSymbol;
}

export interface OptionalArgType<T> extends ArgType<T> {
  // the engine detects optionality by checking for this marker (`'optional' in param`).
  readonly optional: true;
  readonly hasDefault: boolean;
  readonly defaultValue?: T;
}

export type Param<T> = ArgType<T>;

export interface PositionalParam<T = unknown> {
  readonly key: string;
  readonly type: Param<T>;
}

export interface AttributeSpec<Out> {
  readonly level: AttributeLevel;
  readonly name: string;
  readonly positional: readonly PositionalParam[];
  readonly named: Readonly<Record<string, Param<unknown>>>;
  /**
   * Cross-argument validation after all arguments parse. `attributeNode` is
   * the attribute's own AST node so refines can span-anchor their
   * diagnostics at the attribute rather than the enclosing model.
   */
  readonly refine?: (
    parsed: Out,
    ctx: InterpretCtx,
    attributeNode: AstNode,
  ) => readonly PslDiagnostic[];
}

export type OutOf<P> = P extends ArgType<infer T> ? T : never;

export type NamedOut<N extends Record<string, Param<unknown>>> = Simplify<
  { [K in keyof N as N[K] extends OptionalArgType<unknown> ? never : K]: OutOf<N[K]> } & {
    [K in keyof N as N[K] extends OptionalArgType<unknown> ? K : never]?: OutOf<N[K]>;
  }
>;

type PosEntryObject<E extends PositionalParam> =
  E['type'] extends OptionalArgType<unknown>
    ? { [K in E['key']]?: OutOf<E['type']> }
    : { [K in E['key']]: OutOf<E['type']> };

export type PosOut<Pos extends readonly PositionalParam[]> = Simplify<
  UnionToIntersection<{ [I in keyof Pos]: PosEntryObject<Pos[I]> }[number]>
>;

export type AttributeOut<
  Pos extends readonly PositionalParam[],
  Named extends Record<string, Param<unknown>>,
> = Simplify<PosOut<Pos> & NamedOut<Named>>;

// `S` is unconstrained on purpose: `refine` makes `Out` contravariant, so a bound like `S extends AttributeSpec<unknown>` would reject every spec that uses `refine`.
export type InferAttr<S> = S extends AttributeSpec<infer Out> ? Out : never;
