import { resolve } from 'node:path';
import type { MigrationEdge } from '@internal/migration-tools/graph';
import type { PathDecision } from '@internal/migration-tools/migration-graph';
import { describe, expect, it } from 'vitest';
import {
  maskConnectionUrl,
  resolveContractPath,
  resolveMigrationPaths,
  sanitizeErrorMessage,
  toPathDecisionResult,
  toStructuralEdge,
} from '../../src/utils/command-helpers';

describe('maskConnectionUrl', () => {
  it('masks username and password in standard PostgreSQL URL', () => {
    const url = 'postgresql://admin:secret@localhost:5432/mydb';
    const masked = maskConnectionUrl(url);

    expect(masked).toContain('****');
    expect(masked).not.toContain('admin');
    expect(masked).not.toContain('secret');
    expect(masked).toContain('localhost');
    expect(masked).toContain('mydb');
  });

  it('masks password in query parameters', () => {
    const url = 'postgresql://localhost:5432/mydb?password=secret';
    const masked = maskConnectionUrl(url);

    expect(masked).not.toContain('secret');
    expect(masked).toContain('password=****');
  });

  it('masks sslpassword query parameter', () => {
    const url = 'postgresql://localhost:5432/mydb?sslpassword=sslsecret';
    const masked = maskConnectionUrl(url);

    expect(masked).not.toContain('sslsecret');
  });

  it('preserves URL without credentials', () => {
    const url = 'postgresql://localhost:5432/mydb';
    const masked = maskConnectionUrl(url);

    expect(masked).toContain('localhost');
    expect(masked).toContain('mydb');
  });

  it('masks password and user in libpq-style connection string', () => {
    const url = 'host=localhost password=secret user=admin dbname=mydb';
    const masked = maskConnectionUrl(url);

    expect(masked).not.toContain('secret');
    expect(masked).not.toContain('admin');
    expect(masked).toContain('password=****');
    expect(masked).toContain('user=****');
    expect(masked).toContain('host=localhost');
    expect(masked).toContain('dbname=mydb');
  });
});

describe('resolveContractPath', () => {
  it('uses config.contract.output when provided', () => {
    const result = resolveContractPath({ contract: { output: '/custom/path/contract.json' } });
    expect(result).toBe(resolve('/custom/path/contract.json'));
  });

  it('throws when no output is configured', () => {
    expect(() => resolveContractPath({})).toThrow(/contract\.output is required/);
  });

  it('throws when contract config exists but output is undefined', () => {
    expect(() => resolveContractPath({ contract: {} })).toThrow(/contract\.output is required/);
  });
});

describe('sanitizeErrorMessage', () => {
  it('returns message unchanged when no connection URL provided', () => {
    const message = 'Something failed';
    expect(sanitizeErrorMessage(message)).toBe(message);
    expect(sanitizeErrorMessage(message, undefined)).toBe(message);
  });

  it('strips raw connection URL from error message', () => {
    const url = 'postgresql://admin:secret@localhost:5432/mydb';
    const message = `Connection failed: ${url}`;
    const sanitized = sanitizeErrorMessage(message, url);

    expect(sanitized).not.toContain('secret');
    expect(sanitized).not.toContain('admin');
    expect(sanitized).toContain('Connection failed');
  });

  it('strips password that appears independently in the message', () => {
    const url = 'postgresql://admin:supersecret@localhost:5432/mydb';
    const message = 'password authentication failed for user "admin" with password supersecret';
    const sanitized = sanitizeErrorMessage(message, url);

    expect(sanitized).not.toContain('supersecret');
  });

  it('handles libpq-style connection strings in messages', () => {
    const url = 'host=localhost password=secret user=admin dbname=mydb';
    const message = 'Failed to connect: host=localhost password=secret user=admin';
    const sanitized = sanitizeErrorMessage(message, url);

    expect(sanitized).not.toContain('password=secret');
    expect(sanitized).not.toContain('user=admin');
  });
});

describe('toPathDecisionResult', () => {
  function decision(overrides: Partial<PathDecision> = {}): PathDecision {
    return {
      fromHash: 'from',
      toHash: 'to',
      alternativeCount: 0,
      tieBreakReasons: [],
      requiredInvariants: [],
      satisfiedInvariants: [],
      selectedPath: [],
      ...overrides,
    };
  }

  it('passes through requiredInvariants and satisfiedInvariants', () => {
    const result = toPathDecisionResult(
      decision({
        requiredInvariants: ['X', 'Y'],
        satisfiedInvariants: ['X'],
      }),
    );
    expect(result.requiredInvariants).toEqual(['X', 'Y']);
    expect(result.satisfiedInvariants).toEqual(['X']);
  });

  it('defaults requiredInvariants and satisfiedInvariants to empty arrays', () => {
    // PathDecision declares these arrays required; wire inputs may omit keys.
    // Exercise the ?? [] fallback inside toPathDecisionResult.
    const input = { ...(decision() as unknown as Record<string, unknown>) };
    delete input['requiredInvariants'];
    delete input['satisfiedInvariants'];
    // last-resort cast: PathDecision is strict; we omit keys to exercise ?? [] in implementation
    const result = toPathDecisionResult(input as unknown as PathDecision);
    expect(result.requiredInvariants).toEqual([]);
    expect(result.satisfiedInvariants).toEqual([]);
  });

  it('emits per-edge invariants on each selectedPath entry', () => {
    const result = toPathDecisionResult(
      decision({
        selectedPath: [
          {
            from: 'A',
            to: 'B',
            migrationHash: 'mh:1',
            dirName: 'm1',
            createdAt: '2026-01-01T00:00:00.000Z',
            invariants: ['X', 'Y'],
          },
          {
            from: 'B',
            to: 'C',
            migrationHash: 'mh:2',
            dirName: 'm2',
            createdAt: '2026-01-02T00:00:00.000Z',
            invariants: [],
          },
        ],
      }),
    );
    expect(result.selectedPath.map((e) => e.invariants)).toEqual([['X', 'Y'], []]);
  });

  it('omits createdAt from per-edge entries (slim view)', () => {
    const result = toPathDecisionResult(
      decision({
        selectedPath: [
          {
            from: 'A',
            to: 'B',
            migrationHash: 'mh:1',
            dirName: 'm1',
            createdAt: '2026-01-01T00:00:00.000Z',
            invariants: [],
          },
        ],
      }),
    );
    const entry = result.selectedPath[0]!;
    expect(Object.keys(entry).sort()).toEqual([
      'dirName',
      'from',
      'invariants',
      'migrationHash',
      'to',
    ]);
  });
});

describe('resolveMigrationPaths', () => {
  describe('a relative --config naming a project other than the invocation directory', () => {
    it('resolves the config path against cwd, not the process working directory', () => {
      const paths = resolveMigrationPaths('../app/prisma-next.config.ts', {}, '/work/scratch');

      expect(paths.migrationsDir).toBe('/work/app/migrations');
      expect(paths.configPath).toBe('../app/prisma-next.config.ts');
    });

    it('anchors an explicit migrations dir on the config file directory', () => {
      const paths = resolveMigrationPaths(
        '../app/prisma-next.config.ts',
        { migrations: { dir: 'db' } },
        '/work/scratch',
      );

      expect(paths.migrationsDir).toBe('/work/app/db');
    });
  });

  describe('an absolute --config', () => {
    it('is unaffected by cwd', () => {
      const paths = resolveMigrationPaths('/app/prisma-next.config.ts', {}, '/tmp');

      expect(paths.migrationsDir).toBe('/app/migrations');
    });
  });

  describe('no --config', () => {
    it('anchors everything on cwd', () => {
      const paths = resolveMigrationPaths(undefined, {}, '/work/app');

      expect(paths).toMatchObject({
        configPath: 'prisma-next.config.ts',
        migrationsDir: '/work/app/migrations',
        migrationsRelative: 'migrations',
      });
    });
  });

  describe('a migrations dir the config loader already made absolute', () => {
    it('leaves it alone', () => {
      const paths = resolveMigrationPaths(
        undefined,
        { migrations: { dir: '/app/migrations' } },
        '/tmp',
      );

      expect(paths.migrationsDir).toBe('/app/migrations');
    });
  });
});

describe('toStructuralEdge', () => {
  function edge(overrides: Partial<MigrationEdge> = {}): MigrationEdge {
    return {
      from: 'from',
      to: 'to',
      migrationHash: 'mh:1',
      dirName: 'm1',
      createdAt: '2026-01-01T00:00:00.000Z',
      invariants: [],
      ...overrides,
    };
  }

  it('extracts the wire-shape fields and drops authoring metadata', () => {
    const result = toStructuralEdge(
      edge({
        createdAt: '2026-02-01T00:00:00.000Z',
        invariants: ['X', 'Y'],
      }),
    );
    expect(Object.keys(result).sort()).toEqual([
      'dirName',
      'from',
      'invariants',
      'migrationHash',
      'to',
    ]);
    expect(result.invariants).toEqual(['X', 'Y']);
  });
});
