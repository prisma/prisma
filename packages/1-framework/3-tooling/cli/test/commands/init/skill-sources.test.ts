import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SKILL_SOURCES,
  RETIRED_SKILL_NAMES,
} from '../../../src/commands/init/skill-sources';

describe('skill sources', () => {
  it('never retires a skill name it currently installs', () => {
    const installed = new Set<string>(DEFAULT_SKILL_SOURCES.map((source) => source.skill));
    const overlap = RETIRED_SKILL_NAMES.filter((name) => installed.has(name));

    expect(
      overlap,
      'init deletes every RETIRED_SKILL_NAMES directory unconditionally — before the skill install runs, and even under --skip-skills. A name in both RETIRED_SKILL_NAMES and DEFAULT_SKILL_SOURCES means init destroys a skill it just installed, or one --skip-skills promised to leave alone (TML-2637).',
    ).toEqual([]);
  });
});
