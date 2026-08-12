import { describe, expect, it } from 'vitest';
import {
  checkMiddlewareCompatibility,
  type RuntimeMiddleware,
} from '../src/execution/runtime-middleware';

describe('checkMiddlewareCompatibility', () => {
  it('accepts a generic middleware (no familyId) for any runtime', () => {
    const middleware: RuntimeMiddleware = { name: 'telemetry' };
    expect(() => checkMiddlewareCompatibility(middleware, 'sql', 'postgres')).not.toThrow();
    expect(() => checkMiddlewareCompatibility(middleware, 'mongo', 'mongo')).not.toThrow();
  });

  it('accepts a family-matched middleware', () => {
    const middleware: RuntimeMiddleware = { name: 'sql-lints', familyId: 'sql' };
    expect(() => checkMiddlewareCompatibility(middleware, 'sql', 'postgres')).not.toThrow();
  });

  it('throws RUNTIME.MIDDLEWARE_FAMILY_MISMATCH for a family-mismatched middleware', () => {
    const middleware: RuntimeMiddleware = { name: 'sql-lints', familyId: 'sql' };
    expect(() => checkMiddlewareCompatibility(middleware, 'mongo', 'mongo')).toThrow(
      expect.objectContaining({
        name: 'RuntimeError',
        code: 'RUNTIME.MIDDLEWARE_FAMILY_MISMATCH',
        message:
          "Middleware 'sql-lints' requires family 'sql' but the runtime is configured for family 'mongo'",
      }),
    );
  });

  it('accepts a target-matched middleware', () => {
    const middleware: RuntimeMiddleware = {
      name: 'pg-specific',
      familyId: 'sql',
      targetId: 'postgres',
    };
    expect(() => checkMiddlewareCompatibility(middleware, 'sql', 'postgres')).not.toThrow();
  });

  it('throws RUNTIME.MIDDLEWARE_TARGET_MISMATCH for a target-mismatched middleware', () => {
    const middleware: RuntimeMiddleware = {
      name: 'pg-specific',
      familyId: 'sql',
      targetId: 'postgres',
    };
    expect(() => checkMiddlewareCompatibility(middleware, 'sql', 'mysql')).toThrow(
      expect.objectContaining({
        name: 'RuntimeError',
        code: 'RUNTIME.MIDDLEWARE_TARGET_MISMATCH',
        message:
          "Middleware 'pg-specific' requires target 'postgres' but the runtime is configured for target 'mysql'",
      }),
    );
  });

  it('throws RUNTIME.MIDDLEWARE_INCOMPATIBLE for targetId without familyId', () => {
    const middleware: RuntimeMiddleware = {
      name: 'bad',
      targetId: 'postgres',
    };
    expect(() => checkMiddlewareCompatibility(middleware, 'sql', 'postgres')).toThrow(
      expect.objectContaining({
        name: 'RuntimeError',
        code: 'RUNTIME.MIDDLEWARE_INCOMPATIBLE',
        message: "Middleware 'bad' specifies targetId 'postgres' without familyId",
      }),
    );
  });
});
