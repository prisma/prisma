import type { CodecCallContext } from '@internal/framework-components/codec';
import {
  AsyncIterableResult,
  checkAborted,
  checkMiddlewareCompatibility,
  RuntimeCore,
  type RuntimeExecuteOptions,
  type RuntimeMiddlewareContext,
  runBeforeExecuteChain,
  runWithMiddleware,
} from '@internal/framework-components/runtime';
import type { MongoAdapter, MongoDriver } from '@internal/mongo-lowering';
import type { MongoQueryPlan } from '@internal/mongo-query-ast/execution';
import { blindCast } from '@internal/utils/casts';
import { ifDefined } from '@internal/utils/defined';
import { decodeMongoRow } from './codecs/decoding';
import { computeMongoContentHash } from './content-hash';
import type { MongoExecutionPlan } from './mongo-execution-plan';
import type { MongoCodecLookup, MongoExecutionContext } from './mongo-execution-stack';
import type { MongoMiddleware, MongoMiddlewareContext } from './mongo-middleware';
import {
  createMongoParamRefMutator,
  type MongoParamRefMutator,
  type MongoParamRefMutatorInternal,
} from './param-ref-mutator';

function noop() {}

/**
 * Mongo runtime options.
 *
 * The runtime takes a {@link MongoExecutionContext} (built via
 * `createMongoExecutionContext`) and a driver. Codec resolution flows from
 * the context — there is no `codecs` field on this options bag. The adapter
 * is reached via `context.stack.adapter` (instantiated lazily through the
 * stack's `create(stack)` factory). See ADR — Mongo result-shape as a
 * structural plan field, § Codec registry: stack aggregation, not user
 * threading.
 */
export interface MongoRuntimeOptions {
  readonly context: MongoExecutionContext;
  readonly driver: MongoDriver;
  readonly middleware?: readonly MongoMiddleware[];
  readonly mode?: 'strict' | 'permissive';
}

export interface MongoRuntime {
  /**
   * Execute a `MongoQueryPlan` and return an async iterable of rows.
   *
   * The optional `options.signal` is threaded through
   * `lower → adapter.lower → resolveValue → codec.encode` so codec authors
   * who forward the signal to their underlying SDK get true cancellation
   * of in-flight network calls. The runtime additionally observes the
   * signal at two boundaries:
   *
   * - **Already-aborted at entry** — first `next()` throws
   *   `RUNTIME.ABORTED { phase: 'stream' }` before any work is done.
   *   (Inherited from `RuntimeCore.execute`.)
   * - **Mid-encode abort** — surfaces as
   *   `RUNTIME.ABORTED { phase: 'encode' }` from inside `resolveValue`'s
   *   per-level `Promise.all` race.
   *
   * Mongo's read path decodes rows via `resultShape` (per ADR 209). The
   * same `CodecCallContext` is forwarded into each `codec.decode(wire, ctx)`
   * call, so async decoders that respect the signal get cancellation; the
   * runtime itself does not currently emit a `phase: 'decode'` envelope.
   */
  execute<Row>(
    plan: MongoQueryPlan<Row>,
    options?: RuntimeExecuteOptions,
  ): AsyncIterableResult<Row>;
  close(): Promise<void>;
}

class MongoRuntimeImpl
  extends RuntimeCore<MongoQueryPlan, MongoExecutionPlan, MongoMiddleware>
  implements MongoRuntime
{
  readonly #adapter: MongoAdapter;
  readonly #driver: MongoDriver;
  readonly #codecs: MongoCodecLookup;

  constructor(options: MongoRuntimeOptions) {
    const middleware = options.middleware ? [...options.middleware] : [];
    const targetId = options.context.stack.target.targetId;
    for (const mw of middleware) {
      checkMiddlewareCompatibility(mw, 'mongo', targetId);
    }

    const ctx: MongoMiddlewareContext = {
      contract: options.context.contract,
      mode: options.mode ?? 'strict',
      now: () => Date.now(),
      log: { info: noop, warn: noop, error: noop },
      // ctx is only invoked by runWithMiddleware with execs this runtime lowered;
      // the framework parameter type is the cross-family base.
      contentHash: (exec) =>
        computeMongoContentHash(
          blindCast<MongoExecutionPlan, 'runWithMiddleware passes execs this runtime lowered'>(
            exec,
          ),
        ),
      // When MongoRuntimeImpl grows connection()/transaction() surfaces,
      // derive a scope-narrowed ctx per call (mirror
      // SqlRuntime#executeAgainstQueryable in `sql-runtime.ts`).
      scope: 'runtime',
      // Placeholder satisfying the required field on the cross-family base. The
      // stored ctx is a runtime-level template; the per-execute ctx constructed
      // in `execute()` spreads this template and overrides `planExecutionId`
      // with a fresh UUID. ADR 220.
      planExecutionId: '',
    };

    super({ middleware, ctx });

    const adapterDescriptor = options.context.stack.adapter;
    const adapterInstance = adapterDescriptor.create(options.context.stack);
    this.#adapter = adapterInstance;
    this.#driver = options.driver;
    this.#codecs = options.context.codecs;
  }

  /* v8 ignore start -- one-phase lower satisfies RuntimeCore; execute uses structuralLower + resolveParams */
  protected override async lower(
    plan: MongoQueryPlan,
    ctx: CodecCallContext,
  ): Promise<MongoExecutionPlan> {
    return {
      command: await this.#adapter.lower(plan, ctx),
      meta: plan.meta,
      ...ifDefined('resultShape', plan.resultShape),
    };
  }
  /* v8 ignore stop */

  protected override runDriver(exec: MongoExecutionPlan): AsyncIterable<Record<string, unknown>> {
    return this.#driver.execute<Record<string, unknown>>(exec.command);
  }

  override execute<Row>(
    plan: MongoQueryPlan & { readonly _row?: Row },
    options?: RuntimeExecuteOptions,
  ): AsyncIterableResult<Row> {
    const self = this;
    const signal = options?.signal;
    const codecCtx: CodecCallContext = signal === undefined ? {} : { signal };

    // Per-execute middleware context. Spread the stored runtime-level
    // template and mint a fresh `planExecutionId` so every hook in this
    // call observes the same value, and two executions of the same plan
    // observe distinct values. ADR 220. The plan itself flows through
    // unchanged.
    const execCtx: RuntimeMiddlewareContext = {
      ...self.ctx,
      planExecutionId: crypto.randomUUID(),
    };

    const generator = async function* (): AsyncGenerator<Row, void, unknown> {
      checkAborted(codecCtx, 'stream');
      const compiled = await self.runBeforeCompile(plan);

      // Phase 1: structural lower — transforms the AST but leaves MongoParamRef
      // nodes in place so middleware can inspect and rewrite them before
      // codec resolution.
      const draft = self.#adapter.structuralLower(compiled);
      const mutator: MongoParamRefMutatorInternal = createMongoParamRefMutator(draft);

      // Build the plan view for the beforeExecute chain. Middleware accesses
      // plan.meta and the mutator's entries(); plan.command carries the
      // unresolved draft at this stage.
      // The cast is necessary because MongoExecutionPlan.command is typed as
      // AnyMongoWireCommand (the post-resolution shape). No beforeExecute
      // middleware reads plan.command structurally — params are observed via
      // the mutator's entries(). The cast is narrowed to the command slot
      // only so no whole-object information is lost.
      const draftExec: MongoExecutionPlan = {
        meta: compiled.meta,
        ...ifDefined('resultShape', compiled.resultShape),
        command: blindCast<
          MongoExecutionPlan['command'],
          'MongoLoweredDraft held in command slot for the beforeExecute view; resolveParams runs after the chain'
        >(draft),
      };

      await runBeforeExecuteChain<MongoExecutionPlan, MongoParamRefMutator>(
        draftExec,
        self.middleware,
        execCtx,
        mutator,
      );

      // Phase 2: resolve params — converts the (possibly mutated) draft into
      // a frozen wire command. currentDraft() returns the original draft by
      // reference when no middleware called replaceValue/replaceValues (fast path).
      const resolvedCommand = await self.#adapter.resolveParams(mutator.currentDraft(), codecCtx);
      const exec: MongoExecutionPlan = {
        meta: compiled.meta,
        ...ifDefined('resultShape', compiled.resultShape),
        command: resolvedCommand,
      };

      // Phase 3: driver pipeline — runWithMiddleware and decodeMongoRow both
      // receive the fully resolved exec. computeMongoContentHash (called via
      // ctx.contentHash during intercept/afterExecute) therefore hashes the
      // resolved command; no MongoParamRef instance reaches canonicalStringify.
      const stream = runWithMiddleware<MongoExecutionPlan, Record<string, unknown>>(
        exec,
        self.middleware,
        execCtx,
        () => self.runDriver(exec),
      );
      for await (const rawRow of stream) {
        if (exec.resultShape === undefined) {
          yield blindCast<Row, 'driver row matches plan _row phantom when resultShape is absent'>(
            rawRow,
          );
        } else {
          // Source the collection from the lowered exec rather than the
          // pre-lowering plan: a runBeforeCompile middleware is allowed to
          // rewrite collection names during compilation, and the wire command
          // carried by exec is always authoritative for what just ran.
          const decoded = await decodeMongoRow(
            rawRow,
            exec.resultShape,
            self.#codecs,
            exec.command.collection,
            codecCtx,
          );
          yield blindCast<Row, 'decodeMongoRow output matches plan _row phantom'>(decoded);
        }
      }
    };
    return new AsyncIterableResult(generator());
  }

  override async close(): Promise<void> {
    await this.#driver.close();
  }
}

export function createMongoRuntime(options: MongoRuntimeOptions): MongoRuntime {
  return new MongoRuntimeImpl(options);
}
