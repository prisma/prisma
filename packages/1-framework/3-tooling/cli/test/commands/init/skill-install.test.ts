import { describe, expect, it } from 'vitest';
import { version as cliVersion } from '../../../package.json' with { type: 'json' };
import type { PackageManager } from '../../../src/commands/init/detect-package-manager';
import {
  AGENT_SKILL_ROOTS,
  DEFAULT_SKILL_AGENTS,
  DEFAULT_SKILL_BASE,
  DEFAULT_SKILL_SOURCES,
  formatSkillInstallCommand,
  formatSkillSourceUrl,
  legacySkillDirs,
  RETIRED_SKILL_NAMES,
  resolveProjectSkillInstallCommands,
} from '../../../src/commands/init/skill-install';

const PRESERVED_ENV = ['PRISMA_NEXT_SKILLS_BASE'] as const;

const agentFlags = (skill: string) =>
  `--agent ${DEFAULT_SKILL_AGENTS.join(' ')} --skill ${skill} -y`;

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

const usageSource = DEFAULT_SKILL_SOURCES.find((s) => s.skill === 'prisma-8');
const upgradeSource = DEFAULT_SKILL_SOURCES.find((s) => s.skill === 'prisma-next-upgrade');
const extAuthorSource = DEFAULT_SKILL_SOURCES.find((s) => s.skill === 'prisma-8-extension-upgrade');

if (!usageSource || !upgradeSource || !extAuthorSource) {
  throw new Error('DEFAULT_SKILL_SOURCES is missing expected entries');
}

describe('DEFAULT_SKILL_SOURCES', () => {
  it('installs every skill from the consolidated skills/ subpath', () => {
    for (const source of DEFAULT_SKILL_SOURCES) {
      expect(source.subpath).toBe('skills');
    }
  });
});

describe('formatSkillSourceUrl', () => {
  it('pins the usage skill to the CLI version', () => {
    withCleanEnv(() => {
      expect(formatSkillSourceUrl(usageSource)).toBe(`${DEFAULT_SKILL_BASE}/skills#v${cliVersion}`);
    });
  });

  it('leaves the upgrade skill unpinned (always tracks main)', () => {
    withCleanEnv(() => {
      expect(formatSkillSourceUrl(upgradeSource)).toBe(`${DEFAULT_SKILL_BASE}/skills`);
    });
  });

  it('leaves the extension-author upgrade skill unpinned (always tracks main)', () => {
    withCleanEnv(() => {
      expect(formatSkillSourceUrl(extAuthorSource)).toBe(`${DEFAULT_SKILL_BASE}/skills`);
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
      expect(formatSkillSourceUrl(upgradeSource)).toBe('/tmp/clone/skills');
    });
  });
});

describe('formatSkillInstallCommand', () => {
  it.each([
    [
      'npm',
      `npx skills@latest add ${DEFAULT_SKILL_BASE}/skills#v${cliVersion} ${agentFlags('prisma-8')}`,
    ],
    [
      'pnpm',
      `pnpm dlx skills@latest add ${DEFAULT_SKILL_BASE}/skills#v${cliVersion} ${agentFlags('prisma-8')}`,
    ],
    [
      'yarn',
      `yarn dlx skills@latest add ${DEFAULT_SKILL_BASE}/skills#v${cliVersion} ${agentFlags('prisma-8')}`,
    ],
    [
      'bun',
      `bunx skills@latest add ${DEFAULT_SKILL_BASE}/skills#v${cliVersion} ${agentFlags('prisma-8')}`,
    ],
    [
      'deno',
      `deno run -A npm:skills@latest add ${DEFAULT_SKILL_BASE}/skills#v${cliVersion} ${agentFlags('prisma-8')}`,
    ],
  ] satisfies ReadonlyArray<readonly [PackageManager, string]>)(
    'formats %s command with the version-pinned usage source',
    (pm, expected) => {
      withCleanEnv(() => {
        expect(formatSkillInstallCommand({ pm, source: usageSource })).toBe(expected);
      });
    },
  );

  it('pnpm command for the upgrade source omits the #ref fragment and names the skill', () => {
    withCleanEnv(() => {
      expect(formatSkillInstallCommand({ pm: 'pnpm', source: upgradeSource })).toBe(
        `pnpm dlx skills@latest add ${DEFAULT_SKILL_BASE}/skills ${agentFlags('prisma-next-upgrade')}`,
      );
    });
  });

  it('pnpm command for the extension-author source omits the #ref fragment and names the skill', () => {
    withCleanEnv(() => {
      expect(formatSkillInstallCommand({ pm: 'pnpm', source: extAuthorSource })).toBe(
        `pnpm dlx skills@latest add ${DEFAULT_SKILL_BASE}/skills ${agentFlags('prisma-8-extension-upgrade')}`,
      );
    });
  });

  it('honours a custom agents list', () => {
    withCleanEnv(() => {
      expect(
        formatSkillInstallCommand({ pm: 'npm', source: usageSource, agents: ['windsurf'] }),
      ).toBe(
        `npx skills@latest add ${DEFAULT_SKILL_BASE}/skills#v${cliVersion} --agent windsurf --skill prisma-8 -y`,
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
        expect(command).toContain(`--agent ${DEFAULT_SKILL_AGENTS.join(' ')}`);
        expect(command).not.toContain('--all');
        expect(command).not.toContain(`--skill '*'`);
      }
    });
  });
});

describe('legacySkillDirs', () => {
  it('covers every retired or renamed skill in every agent install root', () => {
    const dirs = legacySkillDirs();
    expect(dirs).toHaveLength(RETIRED_SKILL_NAMES.length * AGENT_SKILL_ROOTS.length);
    for (const name of RETIRED_SKILL_NAMES) {
      for (const root of AGENT_SKILL_ROOTS) {
        expect(dirs).toContain(`${root}/${name}`);
      }
    }
  });

  it('covers the pre-rename spellings of the renamed skills', () => {
    const dirs = legacySkillDirs();
    expect(dirs).toContain('.agents/skills/prisma-next');
    expect(dirs).toContain('.claude/skills/prisma-next-extension-upgrade');
    expect(dirs).toContain('.claude/skills/prisma-8-migration-review');
  });

  it('never names the consolidated skill or the current upgrade skills', () => {
    for (const dir of legacySkillDirs()) {
      expect(dir.endsWith('/prisma-8')).toBe(false);
      expect(dir).not.toContain('/prisma-next-upgrade');
      expect(dir).not.toContain('prisma-8-extension-upgrade');
    }
  });
});
