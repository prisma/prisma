import { describe, expect, it } from 'vitest';
import { version as cliVersion } from '../../../package.json' with { type: 'json' };
import type { PackageManager } from '../../../src/commands/init/detect-package-manager';
import {
  DEFAULT_SKILL_AGENTS,
  DEFAULT_SKILL_BASE,
  DEFAULT_SKILL_SOURCES,
  formatSkillInstallCommand,
  formatSkillSourceUrl,
  resolveProjectSkillInstallCommands,
} from '../../../src/commands/init/skill-install';

const PRESERVED_ENV = ['PRISMA_NEXT_SKILLS_BASE'] as const;

const AGENT_FLAGS = `--agent ${DEFAULT_SKILL_AGENTS.join(' ')} --skill '*' -y`;

function withCleanEnv<T>(fn: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const key of PRESERVED_ENV) {
    previous[key] = process.env[key];
    delete process.env[key];
  }
  try {
    return fn();
  } finally {
    for (const key of PRESERVED_ENV) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

const usageSource = DEFAULT_SKILL_SOURCES.find((s) => s.subpath === 'skills');
const upgradeSource = DEFAULT_SKILL_SOURCES.find((s) => s.subpath === 'skills/upgrade');
const extAuthorSource = DEFAULT_SKILL_SOURCES.find((s) => s.subpath === 'skills/extension-author');

if (!usageSource || !upgradeSource || !extAuthorSource) {
  throw new Error('DEFAULT_SKILL_SOURCES is missing expected entries');
}

describe('formatSkillSourceUrl', () => {
  it('pins the usage cluster to the CLI version', () => {
    withCleanEnv(() => {
      expect(formatSkillSourceUrl(usageSource)).toBe(`${DEFAULT_SKILL_BASE}/skills#v${cliVersion}`);
    });
  });

  it('leaves the upgrade cluster unpinned (always tracks main)', () => {
    withCleanEnv(() => {
      expect(formatSkillSourceUrl(upgradeSource)).toBe(`${DEFAULT_SKILL_BASE}/skills/upgrade`);
    });
  });

  it('leaves the extension-author cluster unpinned (always tracks main)', () => {
    withCleanEnv(() => {
      expect(formatSkillSourceUrl(extAuthorSource)).toBe(
        `${DEFAULT_SKILL_BASE}/skills/extension-author`,
      );
    });
  });

  it('substitutes the base from PRISMA_NEXT_SKILLS_BASE when set', () => {
    withCleanEnv(() => {
      process.env['PRISMA_NEXT_SKILLS_BASE'] = 'myuser/prisma-next';
      expect(formatSkillSourceUrl(usageSource)).toBe(`myuser/prisma-next/skills#v${cliVersion}`);
    });
  });

  it('drops the #ref fragment when the base is an absolute local path', () => {
    withCleanEnv(() => {
      process.env['PRISMA_NEXT_SKILLS_BASE'] = '/tmp/clone';
      expect(formatSkillSourceUrl(usageSource)).toBe('/tmp/clone/skills');
      expect(formatSkillSourceUrl(upgradeSource)).toBe('/tmp/clone/skills/upgrade');
    });
  });
});

describe('formatSkillInstallCommand', () => {
  it.each([
    ['npm', `npx skills@latest add ${DEFAULT_SKILL_BASE}/skills#v${cliVersion} ${AGENT_FLAGS}`],
    [
      'pnpm',
      `pnpm dlx skills@latest add ${DEFAULT_SKILL_BASE}/skills#v${cliVersion} ${AGENT_FLAGS}`,
    ],
    [
      'yarn',
      `yarn dlx skills@latest add ${DEFAULT_SKILL_BASE}/skills#v${cliVersion} ${AGENT_FLAGS}`,
    ],
    ['bun', `bunx skills@latest add ${DEFAULT_SKILL_BASE}/skills#v${cliVersion} ${AGENT_FLAGS}`],
    [
      'deno',
      `deno run -A npm:skills@latest add ${DEFAULT_SKILL_BASE}/skills#v${cliVersion} ${AGENT_FLAGS}`,
    ],
  ] satisfies ReadonlyArray<readonly [PackageManager, string]>)(
    'formats %s command with the version-pinned usage source',
    (pm, expected) => {
      withCleanEnv(() => {
        expect(formatSkillInstallCommand({ pm, source: usageSource })).toBe(expected);
      });
    },
  );

  it('pnpm command for the upgrade source omits the #ref fragment', () => {
    withCleanEnv(() => {
      expect(formatSkillInstallCommand({ pm: 'pnpm', source: upgradeSource })).toBe(
        `pnpm dlx skills@latest add ${DEFAULT_SKILL_BASE}/skills/upgrade ${AGENT_FLAGS}`,
      );
    });
  });

  it('pnpm command for the extension-author source omits the #ref fragment', () => {
    withCleanEnv(() => {
      expect(formatSkillInstallCommand({ pm: 'pnpm', source: extAuthorSource })).toBe(
        `pnpm dlx skills@latest add ${DEFAULT_SKILL_BASE}/skills/extension-author ${AGENT_FLAGS}`,
      );
    });
  });

  it('honours a custom agents list', () => {
    withCleanEnv(() => {
      expect(
        formatSkillInstallCommand({ pm: 'npm', source: usageSource, agents: ['windsurf'] }),
      ).toBe(
        `npx skills@latest add ${DEFAULT_SKILL_BASE}/skills#v${cliVersion} --agent windsurf --skill '*' -y`,
      );
    });
  });
});

describe('resolveProjectSkillInstallCommands', () => {
  it('emits one consolidated install per skill source covering every agent', () => {
    withCleanEnv(() => {
      const commands = resolveProjectSkillInstallCommands('pnpm');
      expect(commands).toHaveLength(DEFAULT_SKILL_SOURCES.length);
      for (const command of commands) {
        expect(command).toContain(AGENT_FLAGS);
        expect(command).not.toContain('--all');
      }
    });
  });
});
