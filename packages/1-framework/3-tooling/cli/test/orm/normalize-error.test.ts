import { CliStructuredError } from '@internal/errors/control';
import { CliStructuredError as EngineStructuredError } from '@prisma/cli-engine/protocol';
import { describe, expect, it } from 'vitest';
import { normalizeError, toEngineDiagnostic } from '../../src/orm/normalize-error';
import { errorSpaceNotFound } from '../../src/utils/cli-errors';

describe('normalizeError', () => {
  describe('a prisma/prisma error carrying fix prose', () => {
    const raised = new CliStructuredError('MIGRATION.SPACE_NOT_FOUND', 'Unknown contract space', {
      why: 'No directory named "billing" exists under the migrations root.',
      fix: 'Run `prisma-next migration list` to see every space.',
      where: { path: '/app/migrations' },
      meta: { spaceId: 'billing' },
    });

    it('turns the fix prose into a single next action', () => {
      expect(normalizeError(raised).nextActions).toEqual([
        { kind: 'user-choice', label: 'Run `prisma-next migration list` to see every space.' },
      ]);
    });

    it('carries the code, summary and structured fields through unchanged', () => {
      const normalized = normalizeError(raised);

      expect(normalized.toEnvelope()).toEqual({
        ok: false,
        code: 'MIGRATION.SPACE_NOT_FOUND',
        severity: 'error',
        summary: 'Unknown contract space',
        why: 'No directory named "billing" exists under the migrations root.',
        where: { path: '/app/migrations' },
        meta: { spaceId: 'billing' },
        nextActions: [
          { kind: 'user-choice', label: 'Run `prisma-next migration list` to see every space.' },
        ],
      });
    });

    it('drops the non-protocol fix field', () => {
      expect(normalizeError(raised).toEnvelope()).not.toHaveProperty('fix');
    });

    it('splits multi-line fix prose into one action per line', () => {
      const multiline = new CliStructuredError(
        'MIGRATION.PATH_UNREACHABLE',
        'Cannot reach target',
        {
          fix: 'Plan the missing edge, then apply it:\n  1. prisma-next migration plan\n  2. prisma-next migrate',
        },
      );

      expect(normalizeError(multiline).nextActions).toEqual([
        { kind: 'user-choice', label: 'Plan the missing edge, then apply it:' },
        { kind: 'user-choice', label: '1. prisma-next migration plan' },
        { kind: 'user-choice', label: '2. prisma-next migrate' },
      ]);
    });
  });

  describe('an error with no fix', () => {
    it('produces an empty next-action list rather than undefined', () => {
      const raised = new CliStructuredError('CLI.UNEXPECTED', 'Something went wrong');

      expect(normalizeError(raised).nextActions).toEqual([]);
    });
  });

  describe('a CLI factory carrying typed actions', () => {
    const raised = errorSpaceNotFound('billing', ['app']);

    it('keeps the typed actions instead of deriving them from the prose', () => {
      expect(normalizeError(raised).nextActions).toEqual([
        { kind: 'user-choice', label: 'Pick one of: app' },
        {
          kind: 'run-command',
          label: "See every space's migrations",
          command: 'prisma-next migration list',
        },
      ]);
    });

    it('drops the fix prose the commander shell still renders', () => {
      expect(raised.fix).toBeDefined();
      expect(normalizeError(raised).toEnvelope()).not.toHaveProperty('fix');
    });
  });

  describe('an already-conformant engine error', () => {
    const conformant = new EngineStructuredError('CLI.CONSENT_REQUIRED', 'Consent is required', {
      nextActions: [{ kind: 'run-command', label: 'Confirm', command: 'prisma-next db update' }],
    });

    it('is returned untouched', () => {
      expect(normalizeError(conformant)).toBe(conformant);
    });
  });

  describe('a bare throw', () => {
    it('wraps an Error as CLI.UNEXPECTED with its message', () => {
      const normalized = normalizeError(new Error('connection reset'));

      expect(normalized.toEnvelope()).toEqual({
        ok: false,
        code: 'CLI.UNEXPECTED',
        severity: 'error',
        summary: 'connection reset',
        nextActions: [],
      });
    });

    it('keeps the original as the cause', () => {
      const thrown = new Error('connection reset');

      expect(normalizeError(thrown).cause).toBe(thrown);
    });

    it('wraps a non-Error throw by stringifying it', () => {
      expect(normalizeError('just a string').toEnvelope()).toMatchObject({
        code: 'CLI.UNEXPECTED',
        summary: 'just a string',
      });
    });

    it('describes a throw with no useful message', () => {
      expect(normalizeError(undefined).toEnvelope()).toMatchObject({
        code: 'CLI.UNEXPECTED',
        summary: 'undefined',
      });
    });
  });
});

describe('toEngineDiagnostic', () => {
  it('projects an error onto the protocol diagnostic shape', () => {
    const raised = new CliStructuredError('CONFIG.FILE_NOT_FOUND', 'Config file not found', {
      why: 'No prisma-next.config.ts in /app',
      fix: "Run 'prisma-next init' to create a config file",
      where: { path: '/app/prisma-next.config.ts' },
    });

    expect(toEngineDiagnostic(raised)).toEqual({
      code: 'CONFIG.FILE_NOT_FOUND',
      severity: 'error',
      summary: 'Config file not found',
      why: 'No prisma-next.config.ts in /app',
      where: { path: '/app/prisma-next.config.ts' },
      nextActions: [
        { kind: 'user-choice', label: "Run 'prisma-next init' to create a config file" },
      ],
    });
  });

  it('always carries a next-action list', () => {
    const raised = new CliStructuredError('CLI.UNEXPECTED', 'Boom');

    expect(toEngineDiagnostic(raised).nextActions).toEqual([]);
  });
});
