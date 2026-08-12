import { describe, expect, it, vi } from 'vitest';
import type {
  RuntimeAdapterDescriptor,
  RuntimeDriverDescriptor,
  RuntimeExtensionDescriptor,
  RuntimeTargetDescriptor,
} from '../src/execution/execution-descriptors';
import { createExecutionStack, instantiateExecutionStack } from '../src/execution/execution-stack';

describe('createExecutionStack', () => {
  const target: RuntimeTargetDescriptor<'sql', 'postgres'> = {
    kind: 'target',
    id: 'postgres',
    familyId: 'sql',
    targetId: 'postgres',
    version: '0.0.1',
    create: () => ({ familyId: 'sql', targetId: 'postgres' }),
  };

  const adapter: RuntimeAdapterDescriptor<'sql', 'postgres'> = {
    kind: 'adapter',
    id: 'postgres-adapter',
    familyId: 'sql',
    targetId: 'postgres',
    version: '0.0.1',
    create: () => ({ familyId: 'sql', targetId: 'postgres' }),
  };

  const mockDriverInstance = { familyId: 'sql' as const, targetId: 'postgres' as const };
  const driver: RuntimeDriverDescriptor<'sql', 'postgres', void, typeof mockDriverInstance> = {
    kind: 'driver',
    id: 'pg-driver',
    familyId: 'sql',
    targetId: 'postgres',
    version: '0.0.1',
    create: () => mockDriverInstance,
  };

  const extension: RuntimeExtensionDescriptor<'sql', 'postgres'> = {
    kind: 'extension',
    id: 'pgvector',
    familyId: 'sql',
    targetId: 'postgres',
    version: '1.0.0',
    create: () => ({ familyId: 'sql', targetId: 'postgres', id: 'pgvector' }),
  };

  it('creates stack with required fields', () => {
    const stack = createExecutionStack({
      target,
      adapter,
    });

    expect(stack).toMatchObject({
      target,
      adapter,
      driver: undefined,
      extensions: [],
    });
  });

  it('creates stack with optional driver', () => {
    const stack = createExecutionStack({
      target,
      adapter,
      driver,
    });

    expect(stack.driver).toBe(driver);
  });

  it('creates stack with extension packs', () => {
    const stack = createExecutionStack({
      target,
      adapter,
      extensions: [extension],
    });

    expect(stack.extensions).toEqual([extension]);
  });
});

describe('instantiateExecutionStack', () => {
  it('calls create() on target, adapter, and extensions', () => {
    const targetInstance = { familyId: 'sql' as const, targetId: 'postgres' as const };
    const adapterInstance = { familyId: 'sql' as const, targetId: 'postgres' as const };
    const extensionInstance = {
      familyId: 'sql' as const,
      targetId: 'postgres' as const,
      id: 'pgvector',
    };

    const targetCreate = vi.fn(() => targetInstance);
    const adapterCreate = vi.fn(() => adapterInstance);
    const extensionCreate = vi.fn(() => extensionInstance);

    const target: RuntimeTargetDescriptor<'sql', 'postgres'> = {
      kind: 'target',
      id: 'postgres',
      familyId: 'sql',
      targetId: 'postgres',
      version: '0.0.1',
      create: targetCreate,
    };

    const adapter: RuntimeAdapterDescriptor<'sql', 'postgres'> = {
      kind: 'adapter',
      id: 'postgres-adapter',
      familyId: 'sql',
      targetId: 'postgres',
      version: '0.0.1',
      create: adapterCreate,
    };

    const extension: RuntimeExtensionDescriptor<'sql', 'postgres'> = {
      kind: 'extension',
      id: 'pgvector',
      familyId: 'sql',
      targetId: 'postgres',
      version: '1.0.0',
      create: extensionCreate,
    };

    const stack = createExecutionStack({
      target,
      adapter,
      extensions: [extension],
    });

    const instance = instantiateExecutionStack(stack);

    expect(targetCreate).toHaveBeenCalledOnce();
    expect(adapterCreate).toHaveBeenCalledOnce();
    expect(extensionCreate).toHaveBeenCalledOnce();

    expect(instance).toMatchObject({
      stack,
      target: targetInstance,
      adapter: adapterInstance,
      extensions: [extensionInstance],
    });
  });

  it('handles empty extension packs', () => {
    const target: RuntimeTargetDescriptor<'sql', 'postgres'> = {
      kind: 'target',
      id: 'postgres',
      familyId: 'sql',
      targetId: 'postgres',
      version: '0.0.1',
      create: () => ({ familyId: 'sql', targetId: 'postgres' }),
    };

    const adapter: RuntimeAdapterDescriptor<'sql', 'postgres'> = {
      kind: 'adapter',
      id: 'postgres-adapter',
      familyId: 'sql',
      targetId: 'postgres',
      version: '0.0.1',
      create: () => ({ familyId: 'sql', targetId: 'postgres' }),
    };

    const stack = createExecutionStack({ target, adapter });
    const instance = instantiateExecutionStack(stack);

    expect(instance.extensions).toEqual([]);
  });

  it('returns instance with driver defined when stack has driver descriptor', () => {
    const driverInstance = { familyId: 'sql' as const, targetId: 'postgres' as const };
    const driverCreate = vi.fn(() => driverInstance);
    const driver: RuntimeDriverDescriptor<'sql', 'postgres', void, typeof driverInstance> = {
      kind: 'driver',
      id: 'pg-driver',
      familyId: 'sql',
      targetId: 'postgres',
      version: '0.0.1',
      create: driverCreate,
    };

    const target: RuntimeTargetDescriptor<'sql', 'postgres'> = {
      kind: 'target',
      id: 'postgres',
      familyId: 'sql',
      targetId: 'postgres',
      version: '0.0.1',
      create: () => ({ familyId: 'sql', targetId: 'postgres' }),
    };

    const adapter: RuntimeAdapterDescriptor<'sql', 'postgres'> = {
      kind: 'adapter',
      id: 'postgres-adapter',
      familyId: 'sql',
      targetId: 'postgres',
      version: '0.0.1',
      create: () => ({ familyId: 'sql', targetId: 'postgres' }),
    };

    const stack = createExecutionStack({ target, adapter, driver });
    const instance = instantiateExecutionStack(stack);

    expect(driverCreate).toHaveBeenCalledOnce();
    expect(driverCreate).toHaveBeenCalledWith();
    expect(instance.driver).toBe(driverInstance);
  });

  it('returns instance with driver undefined when stack has no driver descriptor', () => {
    const target: RuntimeTargetDescriptor<'sql', 'postgres'> = {
      kind: 'target',
      id: 'postgres',
      familyId: 'sql',
      targetId: 'postgres',
      version: '0.0.1',
      create: () => ({ familyId: 'sql', targetId: 'postgres' }),
    };

    const adapter: RuntimeAdapterDescriptor<'sql', 'postgres'> = {
      kind: 'adapter',
      id: 'postgres-adapter',
      familyId: 'sql',
      targetId: 'postgres',
      version: '0.0.1',
      create: () => ({ familyId: 'sql', targetId: 'postgres' }),
    };

    const stack = createExecutionStack({ target, adapter });
    const instance = instantiateExecutionStack(stack);

    expect(instance.driver).toBeUndefined();
  });

  it('returns unbound driver when descriptor create accepts optional non-connection options', () => {
    type CursorOptions = { readonly cursor?: string };
    const driverInstance = { familyId: 'sql' as const, targetId: 'postgres' as const };
    const driverCreate = vi.fn((_opts?: CursorOptions) => driverInstance);
    const driver: RuntimeDriverDescriptor<'sql', 'postgres', CursorOptions, typeof driverInstance> =
      {
        kind: 'driver',
        id: 'pg-driver',
        familyId: 'sql',
        targetId: 'postgres',
        version: '0.0.1',
        create: driverCreate,
      };

    const target: RuntimeTargetDescriptor<'sql', 'postgres'> = {
      kind: 'target',
      id: 'postgres',
      familyId: 'sql',
      targetId: 'postgres',
      version: '0.0.1',
      create: () => ({ familyId: 'sql', targetId: 'postgres' }),
    };

    const adapter: RuntimeAdapterDescriptor<'sql', 'postgres'> = {
      kind: 'adapter',
      id: 'postgres-adapter',
      familyId: 'sql',
      targetId: 'postgres',
      version: '0.0.1',
      create: () => ({ familyId: 'sql', targetId: 'postgres' }),
    };

    const stack = createExecutionStack({ target, adapter, driver });
    const instance = instantiateExecutionStack(stack);

    expect(driverCreate).toHaveBeenCalledWith();
    expect(instance.driver).toBe(driverInstance);
  });
});
