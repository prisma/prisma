import {
  type AnnotationValue,
  assertAnnotationsApplicable,
  type OperationKind,
} from './annotations';

/**
 * Per-terminal meta configurator handed to user callbacks. The terminal's
 * operation kind `K` is fixed by the terminal that constructed the builder;
 * `annotate(...)` accepts only annotations whose declared `Kinds` include
 * `K`.
 *
 * The conditional parameter type
 * `K extends Kinds ? AnnotationValue<P, Kinds> : never` collapses to `never`
 * for inapplicable annotations, surfacing the mismatch as a type error at
 * the call site of `meta.annotate(...)`. No variadic-tuple inference is
 * involved — TypeScript infers `Kinds` from the annotation argument and
 * checks the conditional directly.
 *
 * The runtime gate inside `annotate` (via
 * `assertAnnotationsApplicable`) catches cast / `any` / dynamic bypasses
 * and throws `RUNTIME.ANNOTATION_INAPPLICABLE`.
 *
 * `annotate` returns the builder for chaining; the return value of the
 * configurator callback is unused, so both block-body and expression-body
 * callbacks compile.
 *
 * @example
 * ```typescript
 * await db.User.find({ id }, (meta) => meta.annotate(cacheAnnotation({ ttl: 60 })));
 * await db.User.create(input, (meta) => {
 *   meta.annotate(auditAnnotation({ actor: 'system' }));
 *   meta.annotate(otelAnnotation({ traceId }));
 * });
 * ```
 */
export interface MetaBuilder<K extends OperationKind> {
  annotate<P, Kinds extends OperationKind>(
    annotation: K extends Kinds ? AnnotationValue<P, Kinds> : never,
  ): this;
}

/**
 * Lane-side view of a meta builder. Extends the public `MetaBuilder<K>`
 * surface with `annotations` so lane terminals can read the recorded map
 * after invoking the user configurator.
 *
 * Lane terminals construct one of these via `createMetaBuilder(kind, terminalName)`,
 * pass it to the user callback as `MetaBuilder<K>` (the narrower public
 * view), then read `meta.annotations` to thread the recorded values into
 * `plan.meta.annotations`.
 */
export interface LaneMetaBuilder<K extends OperationKind> extends MetaBuilder<K> {
  readonly annotations: ReadonlyMap<string, AnnotationValue<unknown, OperationKind>>;
}

class MetaBuilderImpl<K extends OperationKind> implements LaneMetaBuilder<K> {
  readonly #kind: K;
  readonly #terminalName: string;
  readonly #annotations = new Map<string, AnnotationValue<unknown, OperationKind>>();

  constructor(kind: K, terminalName: string) {
    this.#kind = kind;
    this.#terminalName = terminalName;
  }

  get annotations(): ReadonlyMap<string, AnnotationValue<unknown, OperationKind>> {
    return this.#annotations;
  }

  annotate<P, Kinds extends OperationKind>(
    annotation: K extends Kinds ? AnnotationValue<P, Kinds> : never,
  ): this {
    // Inside the body, the conditional `K extends Kinds ? AnnotationValue<P, Kinds> : never`
    // is opaque to TypeScript — it can't pick a branch without a concrete
    // K. Widen to the structural shape so we can call into the runtime
    // gate. The runtime gate (assertAnnotationsApplicable) is what
    // catches cast bypasses where the conditional would have resolved to
    // `never` had the type checker been allowed to specialise.
    const value = annotation as AnnotationValue<unknown, OperationKind>;
    assertAnnotationsApplicable([value], this.#kind, this.#terminalName);
    this.#annotations.set(value.namespace, value);
    return this;
  }
}

/**
 * Construct a lane-side meta builder for a terminal of operation kind `K`.
 *
 * Lane terminals call this with their `kind` (`'read'` or `'write'`) and a
 * `terminalName` for error messages, hand the resulting builder to the
 * user-supplied configurator callback (typed as `MetaBuilder<K>`, the
 * narrower public view), and read `meta.annotations` afterwards to thread
 * the recorded values into `plan.meta.annotations`.
 */
export function createMetaBuilder<K extends OperationKind>(
  kind: K,
  terminalName: string,
): LaneMetaBuilder<K> {
  return new MetaBuilderImpl(kind, terminalName);
}
