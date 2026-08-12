import type {
  RuntimeAdapterDescriptor,
  RuntimeDriverDescriptor,
  RuntimeExtensionDescriptor,
  RuntimeTargetDescriptor,
} from './execution-descriptors';
import type {
  RuntimeAdapterInstance,
  RuntimeDriverInstance,
  RuntimeExtensionInstance,
  RuntimeTargetInstance,
} from './execution-instances';

export interface ExecutionStack<
  TFamilyId extends string,
  TTargetId extends string,
  TAdapterInstance extends RuntimeAdapterInstance<TFamilyId, TTargetId> = RuntimeAdapterInstance<
    TFamilyId,
    TTargetId
  >,
  TDriverInstance extends RuntimeDriverInstance<TFamilyId, TTargetId> = RuntimeDriverInstance<
    TFamilyId,
    TTargetId
  >,
  TExtensionInstance extends RuntimeExtensionInstance<
    TFamilyId,
    TTargetId
  > = RuntimeExtensionInstance<TFamilyId, TTargetId>,
> {
  readonly target: RuntimeTargetDescriptor<TFamilyId, TTargetId>;
  readonly adapter: RuntimeAdapterDescriptor<TFamilyId, TTargetId, TAdapterInstance>;
  readonly driver:
    | RuntimeDriverDescriptor<TFamilyId, TTargetId, unknown, TDriverInstance>
    | undefined;
  readonly extensions: readonly RuntimeExtensionDescriptor<
    TFamilyId,
    TTargetId,
    TExtensionInstance
  >[];
}

export interface ExecutionStackInstance<
  TFamilyId extends string,
  TTargetId extends string,
  TAdapterInstance extends RuntimeAdapterInstance<TFamilyId, TTargetId> = RuntimeAdapterInstance<
    TFamilyId,
    TTargetId
  >,
  TDriverInstance extends RuntimeDriverInstance<TFamilyId, TTargetId> = RuntimeDriverInstance<
    TFamilyId,
    TTargetId
  >,
  TExtensionInstance extends RuntimeExtensionInstance<
    TFamilyId,
    TTargetId
  > = RuntimeExtensionInstance<TFamilyId, TTargetId>,
> {
  readonly stack: ExecutionStack<
    TFamilyId,
    TTargetId,
    TAdapterInstance,
    TDriverInstance,
    TExtensionInstance
  >;
  readonly target: RuntimeTargetInstance<TFamilyId, TTargetId>;
  readonly adapter: TAdapterInstance;
  readonly driver: TDriverInstance | undefined;
  readonly extensions: readonly TExtensionInstance[];
}

export function createExecutionStack<
  TFamilyId extends string,
  TTargetId extends string,
  TTargetInstance extends RuntimeTargetInstance<TFamilyId, TTargetId>,
  TTargetDescriptor extends RuntimeTargetDescriptor<TFamilyId, TTargetId, TTargetInstance>,
  TAdapterInstance extends RuntimeAdapterInstance<TFamilyId, TTargetId>,
  TAdapterDescriptor extends RuntimeAdapterDescriptor<TFamilyId, TTargetId, TAdapterInstance>,
  TDriverInstance extends RuntimeDriverInstance<TFamilyId, TTargetId> = RuntimeDriverInstance<
    TFamilyId,
    TTargetId
  >,
  TDriverDescriptor extends
    | RuntimeDriverDescriptor<TFamilyId, TTargetId, unknown, TDriverInstance>
    | undefined = undefined,
  TExtensionInstance extends RuntimeExtensionInstance<
    TFamilyId,
    TTargetId
  > = RuntimeExtensionInstance<TFamilyId, TTargetId>,
  TExtensionDescriptor extends RuntimeExtensionDescriptor<
    TFamilyId,
    TTargetId,
    TExtensionInstance
  > = never,
>(input: {
  readonly target: TTargetDescriptor;
  readonly adapter: TAdapterDescriptor;
  readonly driver?: TDriverDescriptor | undefined;
  readonly extensions?: readonly TExtensionDescriptor[] | undefined;
}): ExecutionStack<TFamilyId, TTargetId, TAdapterInstance, TDriverInstance, TExtensionInstance> & {
  readonly target: TTargetDescriptor;
  readonly adapter: TAdapterDescriptor;
  readonly driver: TDriverDescriptor | undefined;
  readonly extensions: readonly TExtensionDescriptor[];
} {
  return {
    target: input.target,
    adapter: input.adapter,
    driver: input.driver,
    extensions: input.extensions ?? [],
  };
}

export function instantiateExecutionStack<
  TFamilyId extends string,
  TTargetId extends string,
  TAdapterInstance extends RuntimeAdapterInstance<TFamilyId, TTargetId>,
  TDriverInstance extends RuntimeDriverInstance<TFamilyId, TTargetId>,
  TExtensionInstance extends RuntimeExtensionInstance<TFamilyId, TTargetId>,
>(
  stack: ExecutionStack<
    TFamilyId,
    TTargetId,
    TAdapterInstance,
    TDriverInstance,
    TExtensionInstance
  >,
): ExecutionStackInstance<
  TFamilyId,
  TTargetId,
  TAdapterInstance,
  TDriverInstance,
  TExtensionInstance
> {
  const driver = stack.driver ? stack.driver.create() : undefined;

  return {
    stack,
    target: stack.target.create(),
    adapter: stack.adapter.create(stack),
    driver,
    extensions: stack.extensions.map((descriptor) => descriptor.create()),
  };
}
