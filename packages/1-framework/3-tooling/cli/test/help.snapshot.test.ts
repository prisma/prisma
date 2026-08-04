import { timeouts } from '@repo/test-utils';
import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import { createContractEmitCommand } from '../src/commands/contract-emit';
import { createContractInferCommand } from '../src/commands/contract-infer';
import { createDbSchemaCommand } from '../src/commands/db-schema';
import { createDbUpdateCommand } from '../src/commands/db-update';
import { createDbVerifyCommand } from '../src/commands/db-verify';
import { createInitCommand } from '../src/commands/init/index';
import { formatCommandHelp, formatRootHelp } from '../src/utils/formatters/help';
import { parseGlobalFlags } from '../src/utils/global-flags';

describe('help text snapshots', { timeout: timeouts.default }, () => {
  it('formats root help', { timeout: timeouts.databaseOperation }, () => {
    const program = new Command();
    program.name('prisma-next').description('Prisma Next CLI');
    const contract = new Command('contract').description('Contract management commands');
    const contractEmit = createContractEmitCommand();
    const contractInfer = createContractInferCommand();
    contract.addCommand(contractEmit);
    contract.addCommand(contractInfer);
    const db = new Command('db').description('Database operations');
    const dbSchema = createDbSchemaCommand();
    const dbVerify = createDbVerifyCommand();
    db.addCommand(dbSchema);
    db.addCommand(dbVerify);
    program.addCommand(contract);
    program.addCommand(db);

    // Explicitly disable colors for consistent snapshots
    const flags = parseGlobalFlags({ 'no-color': true });
    const helpText = formatRootHelp({ program, flags });

    expect(helpText).toMatchSnapshot();
  });

  it('formats contract emit help', () => {
    const command = createContractEmitCommand();
    // Explicitly disable colors for consistent snapshots
    const flags = parseGlobalFlags({ 'no-color': true });
    const helpText = formatCommandHelp({ command, flags });

    expect(helpText).toMatchSnapshot();
  });

  it('formats contract infer help', () => {
    const command = createContractInferCommand();
    const flags = parseGlobalFlags({ 'no-color': true });
    const helpText = formatCommandHelp({ command, flags });

    expect(helpText).toMatchSnapshot();
  });

  it('formats init help', () => {
    const command = createInitCommand();
    const flags = parseGlobalFlags({ 'no-color': true });
    const helpText = formatCommandHelp({ command, flags });

    expect(helpText).toMatchSnapshot();
  });

  it('formats db verify help', () => {
    const command = createDbVerifyCommand();
    // Explicitly disable colors for consistent snapshots
    const flags = parseGlobalFlags({ 'no-color': true });
    const helpText = formatCommandHelp({ command, flags });

    expect(helpText).toMatchSnapshot();
  });

  it('formats root help with no color', () => {
    const program = new Command();
    program.name('prisma-next').description('Prisma Next CLI');
    const contract = new Command('contract').description('Contract management commands');
    const contractEmit = createContractEmitCommand();
    const contractInfer = createContractInferCommand();
    contract.addCommand(contractEmit);
    contract.addCommand(contractInfer);
    const db = new Command('db').description('Database operations');
    const dbSchema = createDbSchemaCommand();
    const dbVerify = createDbVerifyCommand();
    db.addCommand(dbSchema);
    db.addCommand(dbVerify);
    program.addCommand(contract);
    program.addCommand(db);

    const flags = parseGlobalFlags({ 'no-color': true });
    const helpText = formatRootHelp({ program, flags });

    expect(helpText).toMatchSnapshot();
  });

  it('formats contract emit help with no color', () => {
    const command = createContractEmitCommand();
    const flags = parseGlobalFlags({ 'no-color': true });
    const helpText = formatCommandHelp({ command, flags });

    expect(helpText).toMatchSnapshot();
  });

  it('formats db schema help', () => {
    const command = createDbSchemaCommand();
    const flags = parseGlobalFlags({ 'no-color': true });
    const helpText = formatCommandHelp({ command, flags });

    expect(helpText).toMatchSnapshot();
  });

  it('formats db update help', () => {
    const command = createDbUpdateCommand();
    const flags = parseGlobalFlags({ 'no-color': true });
    const helpText = formatCommandHelp({ command, flags });

    expect(helpText).toMatchSnapshot();
  });
});
