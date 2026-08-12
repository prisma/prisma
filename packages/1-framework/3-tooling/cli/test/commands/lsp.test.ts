import { describe, expect, it } from 'vitest';
import { createLspCommand } from '../../src/commands/lsp';
import { getLongDescription } from '../../src/utils/command-helpers';

describe('createLspCommand', () => {
  it('registers a top-level `lsp` command', () => {
    const command = createLspCommand();
    expect(command.name()).toBe('lsp');
  });

  it('exposes the --stdio transport flag', () => {
    const command = createLspCommand();
    const flagNames = command.options.map((option) => option.long);
    expect(flagNames).toContain('--stdio');
    expect(flagNames).not.toContain('--config');
  });

  it('describes diagnostics and whole-document formatting', () => {
    const command = createLspCommand();
    const description = getLongDescription(command);
    expect(description).toContain('PSL parse diagnostics');
    expect(description).toContain('whole-document PSL formatting');
    expect(description).toContain('contract.source.inputs');
  });
});
