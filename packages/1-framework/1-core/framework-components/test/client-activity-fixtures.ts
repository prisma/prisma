import type { ActivityParent } from '../src/execution/activity-lifecycle';
import { startClientActivity } from '../src/execution/client-activity';
import type { ClientActivityKind, RuntimeMiddleware } from '../src/execution/runtime-middleware';
import { startTransactionActivity } from '../src/execution/transaction-activity';
import { contextFields, type MockExec } from './statement-fixtures';

declare module '../src/execution/runtime-middleware' {
  interface ClientActivityKinds {
    'test-call': { result: ReadonlyArray<{ readonly id: number }> };
    'test-count': { result: number };
  }
}

export interface ClientActivitySetup<K extends ClientActivityKind> {
  readonly kind?: K;
  readonly parent?: ActivityParent;
  readonly holdFinishedChildren?: boolean;
}

export function startCall<K extends ClientActivityKind = 'test-call'>(
  middleware: ReadonlyArray<RuntimeMiddleware<MockExec>>,
  setup: ClientActivitySetup<K> = {},
) {
  return startClientActivity({
    middleware,
    kind: setup.kind ?? ('test-call' as K),
    contentHash: 'call-hash',
    annotations: undefined,
    context: contextFields(),
    parent: setup.parent,
    holdFinishedChildren: setup.holdFinishedChildren ?? true,
  });
}

export function openTransaction(
  middleware: ReadonlyArray<RuntimeMiddleware<MockExec>>,
  setup: { readonly parent?: ActivityParent; readonly holdFinishedChildren?: boolean } = {},
) {
  return startTransactionActivity({
    middleware,
    context: contextFields({ scope: 'transaction' }),
    parent: setup.parent,
    holdFinishedChildren: setup.holdFinishedChildren ?? true,
  });
}

export function gate(): { readonly wait: Promise<void>; readonly release: () => void } {
  let release: () => void = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release };
}

export function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
