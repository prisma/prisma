import type { NextAction } from '@internal/utils/structured-error';
import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import packageJson from '../package.json' with { type: 'json' };
import { BIN_NAME } from '../src/utils/bin-name';
import type { CliErrorEnvelope } from '../src/utils/cli-errors';
import {
  formatErrorJson,
  formatErrorOutput,
  resolveBinPlaceholder,
} from '../src/utils/formatters/errors';
import { parseGlobalFlags } from '../src/utils/global-flags';

const envelopeWith = (nextActions: readonly NextAction[]): CliErrorEnvelope => ({
  ok: false,
  code: 'MIGRATION.UNKNOWN_REF',
  severity: 'error',
  summary: 'Unknown ref "staging"',
  why: 'No ref file found.',
  fix: 'Create the ref with: prisma-next ref set staging <hash>',
  nextActions,
});

describe('BIN_NAME', () => {
  it('matches the single binary this package installs', () => {
    expect(Object.keys(packageJson.bin)).toEqual([BIN_NAME]);
  });
});

describe('resolveBinPlaceholder', () => {
  it('substitutes {bin} in a command', () => {
    const envelope = resolveBinPlaceholder(
      envelopeWith([
        { kind: 'run-command', label: 'Create the ref', command: '{bin} ref set staging <hash>' },
      ]),
      'prisma-next',
    );

    expect(envelope.nextActions).toEqual([
      {
        kind: 'run-command',
        label: 'Create the ref',
        command: 'prisma-next ref set staging <hash>',
      },
    ]);
  });

  it('substitutes {bin} in every entry of a commands sequence', () => {
    const envelope = resolveBinPlaceholder(
      envelopeWith([
        {
          kind: 'run-command',
          label: 'Reinitialise',
          commands: ['{bin} db init', '{bin} db sign'],
        },
      ]),
      'prisma-next',
    );

    expect(envelope.nextActions?.[0]?.commands).toEqual([
      'prisma-next db init',
      'prisma-next db sign',
    ]);
  });

  it('substitutes every occurrence within one command', () => {
    const envelope = resolveBinPlaceholder(
      envelopeWith([
        { kind: 'run-command', label: 'Two steps', command: '{bin} db init && {bin} db sign' },
      ]),
      'prisma-next',
    );

    expect(envelope.nextActions?.[0]?.command).toBe('prisma-next db init && prisma-next db sign');
  });

  it('renders whatever binary name it is given, so the same action serves any bin', () => {
    const envelope = resolveBinPlaceholder(
      envelopeWith([{ kind: 'run-command', label: 'Create the ref', command: '{bin} ref list' }]),
      'prisma',
    );

    expect(envelope.nextActions?.[0]?.command).toBe('prisma ref list');
  });

  it('leaves actions that carry no command untouched', () => {
    const actions: readonly NextAction[] = [
      { kind: 'edit-file', label: 'Adjust your contract' },
      { kind: 'open-url', label: 'Read the docs', url: 'https://example.com/{bin}' },
    ];

    expect(resolveBinPlaceholder(envelopeWith(actions), 'prisma-next').nextActions).toEqual(
      actions,
    );
  });

  it('leaves an envelope without nextActions untouched', () => {
    const envelope: CliErrorEnvelope = {
      ok: false,
      code: 'CLI.UNEXPECTED',
      severity: 'error',
      summary: 'Boom',
    };

    expect(resolveBinPlaceholder(envelope, 'prisma-next')).toEqual(envelope);
  });
});

describe('formatErrorJson', () => {
  it('emits nextActions with {bin} already substituted, so no placeholder reaches a consumer', () => {
    const json = formatErrorJson(
      envelopeWith([
        { kind: 'run-command', label: 'Create the ref', command: '{bin} ref set staging <hash>' },
      ]),
    );

    expect(json).not.toContain('{bin}');
    expect(JSON.parse(json).nextActions).toEqual([
      {
        kind: 'run-command',
        label: 'Create the ref',
        command: `${BIN_NAME} ref set staging <hash>`,
      },
    ]);
  });

  it('keeps fix alongside nextActions during the conversion transition', () => {
    const json = formatErrorJson(
      envelopeWith([{ kind: 'run-command', label: 'Create the ref', command: '{bin} ref list' }]),
    );

    expect(JSON.parse(json).fix).toBe('Create the ref with: prisma-next ref set staging <hash>');
  });
});

describe('formatErrorOutput', () => {
  it('renders exactly the pre-nextActions human output — Why and Fix, nothing more', () => {
    const flags = parseGlobalFlags({ 'no-color': true });
    const actions: readonly NextAction[] = [
      { kind: 'run-command', label: 'Create the ref', command: '{bin} ref set staging <hash>' },
    ];

    const withActions = stripAnsi(formatErrorOutput(envelopeWith(actions), flags));
    const withoutActions = stripAnsi(formatErrorOutput(envelopeWith([]), flags));

    expect(withActions).toBe(withoutActions);
    expect(withActions).toBe(
      [
        '✖ Unknown ref "staging" (MIGRATION.UNKNOWN_REF)',
        '  Why: No ref file found.',
        '  Fix: Create the ref with: prisma-next ref set staging <hash>',
      ].join('\n'),
    );
  });
});
