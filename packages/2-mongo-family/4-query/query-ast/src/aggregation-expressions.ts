import { MongoAstNode } from './ast-node';
import { ormError } from './orm-errors';
import type { MongoAggExprRewriter, MongoAggExprVisitor } from './visitors';

export type AggRecordArgs = Readonly<Record<string, MongoAggExpr | ReadonlyArray<MongoAggExpr>>>;

export function isExprArray(
  args: MongoAggExpr | ReadonlyArray<MongoAggExpr> | AggRecordArgs,
): args is ReadonlyArray<MongoAggExpr> {
  return Array.isArray(args);
}

export function isRecordArgs(
  args: MongoAggExpr | ReadonlyArray<MongoAggExpr> | AggRecordArgs,
): args is AggRecordArgs {
  return !Array.isArray(args) && typeof args === 'object' && !('accept' in args);
}

function freezeRecordArgs(record: AggRecordArgs): AggRecordArgs {
  const frozen: Record<string, MongoAggExpr | ReadonlyArray<MongoAggExpr>> = {};
  for (const [key, val] of Object.entries(record)) {
    frozen[key] = Array.isArray(val) ? Object.freeze([...val]) : val;
  }
  return Object.freeze(frozen);
}

function rewriteRecordArgs(record: AggRecordArgs, rewriter: MongoAggExprRewriter): AggRecordArgs {
  const result: Record<string, MongoAggExpr | ReadonlyArray<MongoAggExpr>> = {};
  for (const [key, val] of Object.entries(record)) {
    if (Array.isArray(val)) {
      result[key] = val.map((v: MongoAggExpr) => v.rewrite(rewriter));
    } else {
      result[key] = (val as MongoAggExpr).rewrite(rewriter);
    }
  }
  return result;
}

abstract class MongoAggExprNode extends MongoAstNode {
  abstract accept<R>(visitor: MongoAggExprVisitor<R>): R;
  abstract rewrite(rewriter: MongoAggExprRewriter): MongoAggExpr;
}

export class MongoAggFieldRef extends MongoAggExprNode {
  readonly kind = 'fieldRef' as const;
  readonly path: string;

  constructor(path: string) {
    super();
    if (!path) {
      throw ormError('ORM.ARGUMENT_INVALID', 'Field path must not be empty');
    }
    this.path = path;
    this.freeze();
  }

  static of(path: string): MongoAggFieldRef {
    return new MongoAggFieldRef(path);
  }

  accept<R>(visitor: MongoAggExprVisitor<R>): R {
    return visitor.fieldRef(this);
  }

  rewrite(rewriter: MongoAggExprRewriter): MongoAggExpr {
    return rewriter.fieldRef ? rewriter.fieldRef(this) : this;
  }
}

export class MongoAggLiteral extends MongoAggExprNode {
  readonly kind = 'literal' as const;
  readonly value: unknown;

  constructor(value: unknown) {
    super();
    this.value = value;
    this.freeze();
  }

  static of(value: unknown): MongoAggLiteral {
    return new MongoAggLiteral(value);
  }

  accept<R>(visitor: MongoAggExprVisitor<R>): R {
    return visitor.literal(this);
  }

  rewrite(rewriter: MongoAggExprRewriter): MongoAggExpr {
    return rewriter.literal ? rewriter.literal(this) : this;
  }
}

export class MongoAggOperator extends MongoAggExprNode {
  readonly kind = 'operator' as const;
  readonly op: string;
  readonly args: MongoAggExpr | ReadonlyArray<MongoAggExpr> | AggRecordArgs;

  constructor(op: string, args: MongoAggExpr | ReadonlyArray<MongoAggExpr> | AggRecordArgs) {
    super();
    this.op = op;
    if (Array.isArray(args)) {
      this.args = Object.freeze([...args]);
    } else if (isRecordArgs(args)) {
      this.args = freezeRecordArgs(args);
    } else {
      this.args = args;
    }
    this.freeze();
  }

  static of(
    op: string,
    args: MongoAggExpr | ReadonlyArray<MongoAggExpr> | AggRecordArgs,
  ): MongoAggOperator {
    return new MongoAggOperator(op, args);
  }

  static add(...args: ReadonlyArray<MongoAggExpr>): MongoAggOperator {
    return new MongoAggOperator('$add', args);
  }

  static subtract(left: MongoAggExpr, right: MongoAggExpr): MongoAggOperator {
    return new MongoAggOperator('$subtract', [left, right]);
  }

  static multiply(...args: ReadonlyArray<MongoAggExpr>): MongoAggOperator {
    return new MongoAggOperator('$multiply', args);
  }

  static divide(dividend: MongoAggExpr, divisor: MongoAggExpr): MongoAggOperator {
    return new MongoAggOperator('$divide', [dividend, divisor]);
  }

  static concat(...args: ReadonlyArray<MongoAggExpr>): MongoAggOperator {
    return new MongoAggOperator('$concat', args);
  }

  static toLower(expr: MongoAggExpr): MongoAggOperator {
    return new MongoAggOperator('$toLower', expr);
  }

  static toUpper(expr: MongoAggExpr): MongoAggOperator {
    return new MongoAggOperator('$toUpper', expr);
  }

  static size(expr: MongoAggExpr): MongoAggOperator {
    return new MongoAggOperator('$size', expr);
  }

  accept<R>(visitor: MongoAggExprVisitor<R>): R {
    return visitor.operator(this);
  }

  rewrite(rewriter: MongoAggExprRewriter): MongoAggExpr {
    const { args } = this;
    let rewrittenArgs: MongoAggExpr | ReadonlyArray<MongoAggExpr> | AggRecordArgs;
    if (isExprArray(args)) {
      rewrittenArgs = args.map((a) => a.rewrite(rewriter));
    } else if (isRecordArgs(args)) {
      rewrittenArgs = rewriteRecordArgs(args, rewriter);
    } else {
      rewrittenArgs = args.rewrite(rewriter);
    }
    const rebuilt = new MongoAggOperator(this.op, rewrittenArgs);
    return rewriter.operator ? rewriter.operator(rebuilt) : rebuilt;
  }
}

export class MongoAggAccumulator extends MongoAggExprNode {
  readonly kind = 'accumulator' as const;
  readonly op: string;
  readonly arg: MongoAggExpr | AggRecordArgs | null;

  constructor(op: string, arg: MongoAggExpr | AggRecordArgs | null) {
    super();
    this.op = op;
    if (arg !== null && isRecordArgs(arg)) {
      this.arg = freezeRecordArgs(arg);
    } else {
      this.arg = arg;
    }
    this.freeze();
  }

  static of(op: string, arg: MongoAggExpr | AggRecordArgs | null): MongoAggAccumulator {
    return new MongoAggAccumulator(op, arg);
  }

  static sum(expr: MongoAggExpr): MongoAggAccumulator {
    return new MongoAggAccumulator('$sum', expr);
  }

  static avg(expr: MongoAggExpr): MongoAggAccumulator {
    return new MongoAggAccumulator('$avg', expr);
  }

  static min(expr: MongoAggExpr): MongoAggAccumulator {
    return new MongoAggAccumulator('$min', expr);
  }

  static max(expr: MongoAggExpr): MongoAggAccumulator {
    return new MongoAggAccumulator('$max', expr);
  }

  static first(expr: MongoAggExpr): MongoAggAccumulator {
    return new MongoAggAccumulator('$first', expr);
  }

  static last(expr: MongoAggExpr): MongoAggAccumulator {
    return new MongoAggAccumulator('$last', expr);
  }

  static push(expr: MongoAggExpr): MongoAggAccumulator {
    return new MongoAggAccumulator('$push', expr);
  }

  static addToSet(expr: MongoAggExpr): MongoAggAccumulator {
    return new MongoAggAccumulator('$addToSet', expr);
  }

  static count(): MongoAggAccumulator {
    return new MongoAggAccumulator('$count', null);
  }

  static stdDevPop(expr: MongoAggExpr): MongoAggAccumulator {
    return new MongoAggAccumulator('$stdDevPop', expr);
  }

  static stdDevSamp(expr: MongoAggExpr): MongoAggAccumulator {
    return new MongoAggAccumulator('$stdDevSamp', expr);
  }

  accept<R>(visitor: MongoAggExprVisitor<R>): R {
    return visitor.accumulator(this);
  }

  rewrite(rewriter: MongoAggExprRewriter): MongoAggExpr {
    let rewrittenArg: MongoAggExpr | AggRecordArgs | null;
    if (this.arg === null) {
      rewrittenArg = null;
    } else if (isRecordArgs(this.arg)) {
      rewrittenArg = rewriteRecordArgs(this.arg, rewriter);
    } else {
      rewrittenArg = this.arg.rewrite(rewriter);
    }
    const rebuilt = new MongoAggAccumulator(this.op, rewrittenArg);
    return rewriter.accumulator ? rewriter.accumulator(rebuilt) : rebuilt;
  }
}

export class MongoAggCond extends MongoAggExprNode {
  readonly kind = 'cond' as const;
  readonly condition: MongoAggExpr;
  readonly then_: MongoAggExpr;
  readonly else_: MongoAggExpr;

  constructor(condition: MongoAggExpr, then_: MongoAggExpr, else_: MongoAggExpr) {
    super();
    this.condition = condition;
    this.then_ = then_;
    this.else_ = else_;
    this.freeze();
  }

  static of(condition: MongoAggExpr, then_: MongoAggExpr, else_: MongoAggExpr): MongoAggCond {
    return new MongoAggCond(condition, then_, else_);
  }

  accept<R>(visitor: MongoAggExprVisitor<R>): R {
    return visitor.cond(this);
  }

  rewrite(rewriter: MongoAggExprRewriter): MongoAggExpr {
    const rebuilt = new MongoAggCond(
      this.condition.rewrite(rewriter),
      this.then_.rewrite(rewriter),
      this.else_.rewrite(rewriter),
    );
    return rewriter.cond ? rewriter.cond(rebuilt) : rebuilt;
  }
}

export interface MongoAggSwitchBranch {
  readonly case_: MongoAggExpr;
  readonly then_: MongoAggExpr;
}

export class MongoAggSwitch extends MongoAggExprNode {
  readonly kind = 'switch' as const;
  readonly branches: ReadonlyArray<MongoAggSwitchBranch>;
  readonly default_: MongoAggExpr;

  constructor(branches: ReadonlyArray<MongoAggSwitchBranch>, default_: MongoAggExpr) {
    super();
    this.branches = Object.freeze(
      branches.map((b) => Object.freeze({ case_: b.case_, then_: b.then_ })),
    );
    this.default_ = default_;
    this.freeze();
  }

  static of(branches: ReadonlyArray<MongoAggSwitchBranch>, default_: MongoAggExpr): MongoAggSwitch {
    return new MongoAggSwitch(branches, default_);
  }

  accept<R>(visitor: MongoAggExprVisitor<R>): R {
    return visitor.switch_(this);
  }

  rewrite(rewriter: MongoAggExprRewriter): MongoAggExpr {
    const rebuilt = new MongoAggSwitch(
      this.branches.map((b) => ({
        case_: b.case_.rewrite(rewriter),
        then_: b.then_.rewrite(rewriter),
      })),
      this.default_.rewrite(rewriter),
    );
    return rewriter.switch_ ? rewriter.switch_(rebuilt) : rebuilt;
  }
}

export class MongoAggArrayFilter extends MongoAggExprNode {
  readonly kind = 'filter' as const;
  readonly input: MongoAggExpr;
  readonly cond: MongoAggExpr;
  readonly as: string;

  constructor(input: MongoAggExpr, cond: MongoAggExpr, as: string) {
    super();
    this.input = input;
    this.cond = cond;
    this.as = as;
    this.freeze();
  }

  static of(input: MongoAggExpr, cond: MongoAggExpr, as: string): MongoAggArrayFilter {
    return new MongoAggArrayFilter(input, cond, as);
  }

  accept<R>(visitor: MongoAggExprVisitor<R>): R {
    return visitor.filter(this);
  }

  rewrite(rewriter: MongoAggExprRewriter): MongoAggExpr {
    const rebuilt = new MongoAggArrayFilter(
      this.input.rewrite(rewriter),
      this.cond.rewrite(rewriter),
      this.as,
    );
    return rewriter.filter ? rewriter.filter(rebuilt) : rebuilt;
  }
}

export class MongoAggMap extends MongoAggExprNode {
  readonly kind = 'map' as const;
  readonly input: MongoAggExpr;
  readonly in_: MongoAggExpr;
  readonly as: string;

  constructor(input: MongoAggExpr, in_: MongoAggExpr, as: string) {
    super();
    this.input = input;
    this.in_ = in_;
    this.as = as;
    this.freeze();
  }

  static of(input: MongoAggExpr, in_: MongoAggExpr, as: string): MongoAggMap {
    return new MongoAggMap(input, in_, as);
  }

  accept<R>(visitor: MongoAggExprVisitor<R>): R {
    return visitor.map(this);
  }

  rewrite(rewriter: MongoAggExprRewriter): MongoAggExpr {
    const rebuilt = new MongoAggMap(
      this.input.rewrite(rewriter),
      this.in_.rewrite(rewriter),
      this.as,
    );
    return rewriter.map ? rewriter.map(rebuilt) : rebuilt;
  }
}

export class MongoAggReduce extends MongoAggExprNode {
  readonly kind = 'reduce' as const;
  readonly input: MongoAggExpr;
  readonly initialValue: MongoAggExpr;
  readonly in_: MongoAggExpr;

  constructor(input: MongoAggExpr, initialValue: MongoAggExpr, in_: MongoAggExpr) {
    super();
    this.input = input;
    this.initialValue = initialValue;
    this.in_ = in_;
    this.freeze();
  }

  static of(input: MongoAggExpr, initialValue: MongoAggExpr, in_: MongoAggExpr): MongoAggReduce {
    return new MongoAggReduce(input, initialValue, in_);
  }

  accept<R>(visitor: MongoAggExprVisitor<R>): R {
    return visitor.reduce(this);
  }

  rewrite(rewriter: MongoAggExprRewriter): MongoAggExpr {
    const rebuilt = new MongoAggReduce(
      this.input.rewrite(rewriter),
      this.initialValue.rewrite(rewriter),
      this.in_.rewrite(rewriter),
    );
    return rewriter.reduce ? rewriter.reduce(rebuilt) : rebuilt;
  }
}

export class MongoAggLet extends MongoAggExprNode {
  readonly kind = 'let' as const;
  readonly vars: Readonly<Record<string, MongoAggExpr>>;
  readonly in_: MongoAggExpr;

  constructor(vars: Record<string, MongoAggExpr>, in_: MongoAggExpr) {
    super();
    this.vars = Object.freeze({ ...vars });
    this.in_ = in_;
    this.freeze();
  }

  static of(vars: Record<string, MongoAggExpr>, in_: MongoAggExpr): MongoAggLet {
    return new MongoAggLet(vars, in_);
  }

  accept<R>(visitor: MongoAggExprVisitor<R>): R {
    return visitor.let_(this);
  }

  rewrite(rewriter: MongoAggExprRewriter): MongoAggExpr {
    const rewrittenVars: Record<string, MongoAggExpr> = {};
    for (const [key, val] of Object.entries(this.vars)) {
      rewrittenVars[key] = val.rewrite(rewriter);
    }
    const rebuilt = new MongoAggLet(rewrittenVars, this.in_.rewrite(rewriter));
    return rewriter.let_ ? rewriter.let_(rebuilt) : rebuilt;
  }
}

export class MongoAggMergeObjects extends MongoAggExprNode {
  readonly kind = 'mergeObjects' as const;
  readonly exprs: ReadonlyArray<MongoAggExpr>;

  constructor(exprs: ReadonlyArray<MongoAggExpr>) {
    super();
    this.exprs = Object.freeze([...exprs]);
    this.freeze();
  }

  static of(exprs: ReadonlyArray<MongoAggExpr>): MongoAggMergeObjects {
    return new MongoAggMergeObjects(exprs);
  }

  accept<R>(visitor: MongoAggExprVisitor<R>): R {
    return visitor.mergeObjects(this);
  }

  rewrite(rewriter: MongoAggExprRewriter): MongoAggExpr {
    const rebuilt = new MongoAggMergeObjects(this.exprs.map((e) => e.rewrite(rewriter)));
    return rewriter.mergeObjects ? rewriter.mergeObjects(rebuilt) : rebuilt;
  }
}

export type MongoAggExpr =
  | MongoAggFieldRef
  | MongoAggLiteral
  | MongoAggOperator
  | MongoAggAccumulator
  | MongoAggCond
  | MongoAggSwitch
  | MongoAggArrayFilter
  | MongoAggMap
  | MongoAggReduce
  | MongoAggLet
  | MongoAggMergeObjects;
