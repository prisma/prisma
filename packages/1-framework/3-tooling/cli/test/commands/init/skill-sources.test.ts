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
      'a name in both lists would mark a skill init installs for deletion (TML-2637)',
    ).toEqual([]);
  });
});
