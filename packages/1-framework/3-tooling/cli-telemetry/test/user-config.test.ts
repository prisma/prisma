import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureInstallationId,
  readUserConfig,
  userConfigPath,
  writeUserConfig,
} from '../src/user-config';

describe('readUserConfig / writeUserConfig', () => {
  let xdgRoot: string;
  let originalXdg: string | undefined;

  beforeEach(() => {
    xdgRoot = mkdtempSync(join(tmpdir(), 'prisma-8-cli-telemetry-'));
    originalXdg = process.env['XDG_CONFIG_HOME'];
    process.env['XDG_CONFIG_HOME'] = xdgRoot;
    mkdirSync(dirname(userConfigPath()), { recursive: true });
  });

  afterEach(() => {
    if (originalXdg === undefined) {
      delete process.env['XDG_CONFIG_HOME'];
    } else {
      process.env['XDG_CONFIG_HOME'] = originalXdg;
    }
    rmSync(xdgRoot, { recursive: true, force: true });
  });

  it('returns an empty object when the config file does not exist', () => {
    expect(readUserConfig()).toEqual({});
    expect(existsSync(userConfigPath())).toBe(false);
  });

  it('parses a well-formed config and exposes both known fields', () => {
    const path = userConfigPath();
    writeFileSync(
      path,
      JSON.stringify({ enableTelemetry: true, installationId: 'pre-existing-uuid' }),
    );
    const cfg = readUserConfig();
    expect(cfg.enableTelemetry).toBe(true);
    expect(cfg.installationId).toBe('pre-existing-uuid');
  });

  it('preserves unknown fields on read (forward compat)', () => {
    const path = userConfigPath();
    writeFileSync(
      path,
      JSON.stringify({
        enableTelemetry: true,
        installationId: 'id-1',
        someFutureField: 'opaque',
        nested: { foo: 'bar' },
      }),
    );
    const cfg = readUserConfig() as Record<string, unknown>;
    expect(cfg['someFutureField']).toBe('opaque');
    expect(cfg['nested']).toEqual({ foo: 'bar' });
  });

  it('tolerates a malformed (unparseable) file by returning an empty object', () => {
    writeFileSync(userConfigPath(), '{not valid json');
    expect(readUserConfig()).toEqual({});
  });

  it('writeUserConfig({enableTelemetry: true}) generates a v4 installationId and persists both', () => {
    writeUserConfig({ enableTelemetry: true });
    const cfg = readUserConfig();
    expect(cfg.enableTelemetry).toBe(true);
    expect(cfg.installationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('writeUserConfig({enableTelemetry: true}) preserves an existing installationId rather than rotating it', () => {
    writeFileSync(userConfigPath(), JSON.stringify({ installationId: 'sticky-id-do-not-rotate' }));
    writeUserConfig({ enableTelemetry: true });
    expect(readUserConfig().installationId).toBe('sticky-id-do-not-rotate');
  });

  it('writeUserConfig({enableTelemetry: false}) does NOT generate an installationId', () => {
    writeUserConfig({ enableTelemetry: false });
    const cfg = readUserConfig();
    expect(cfg.enableTelemetry).toBe(false);
    expect(cfg.installationId).toBeUndefined();
  });

  it('writeUserConfig merges with existing fields and preserves unknown ones', () => {
    writeFileSync(
      userConfigPath(),
      JSON.stringify({
        installationId: 'kept',
        unknown: 'preserve-me',
        nested: { foo: 1 },
      }),
    );
    writeUserConfig({ enableTelemetry: true });
    const cfg = readUserConfig() as Record<string, unknown>;
    expect(cfg['enableTelemetry']).toBe(true);
    expect(cfg['installationId']).toBe('kept');
    expect(cfg['unknown']).toBe('preserve-me');
    expect(cfg['nested']).toEqual({ foo: 1 });
  });

  it('writes via temp-file-and-rename so a half-written file is never observable', () => {
    writeUserConfig({ enableTelemetry: true });
    const raw = readFileSync(userConfigPath(), 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('creates the parent directory if missing', () => {
    rmSync(xdgRoot, { recursive: true, force: true });
    writeUserConfig({ enableTelemetry: false });
    expect(existsSync(userConfigPath())).toBe(true);
  });
});

describe('ensureInstallationId', () => {
  let xdgRoot: string;
  let originalXdg: string | undefined;

  beforeEach(() => {
    xdgRoot = mkdtempSync(join(tmpdir(), 'prisma-8-cli-telemetry-id-'));
    originalXdg = process.env['XDG_CONFIG_HOME'];
    process.env['XDG_CONFIG_HOME'] = xdgRoot;
    mkdirSync(dirname(userConfigPath()), { recursive: true });
  });

  afterEach(() => {
    if (originalXdg === undefined) {
      delete process.env['XDG_CONFIG_HOME'];
    } else {
      process.env['XDG_CONFIG_HOME'] = originalXdg;
    }
    rmSync(xdgRoot, { recursive: true, force: true });
  });

  it('mints and persists a v4 UUID when none is stored', () => {
    const id = ensureInstallationId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(readUserConfig().installationId).toBe(id);
  });

  it('does NOT set enableTelemetry when minting', () => {
    ensureInstallationId();
    expect(readUserConfig().enableTelemetry).toBeUndefined();
  });

  it('returns the existing id and does not rotate it', () => {
    writeFileSync(userConfigPath(), JSON.stringify({ installationId: 'sticky-id' }));
    expect(ensureInstallationId()).toBe('sticky-id');
    expect(readUserConfig().installationId).toBe('sticky-id');
  });

  it('preserves an existing enableTelemetry: false while minting an id', () => {
    writeFileSync(userConfigPath(), JSON.stringify({ enableTelemetry: false }));
    ensureInstallationId();
    const cfg = readUserConfig();
    expect(cfg.installationId).toBeDefined();
    expect(cfg.enableTelemetry).toBe(false);
  });
});
