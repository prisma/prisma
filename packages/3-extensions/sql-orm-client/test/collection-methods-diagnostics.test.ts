import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'pathe';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(testDir, 'collection-methods-diagnostics.virtual.ts');

const fixture = `
import { websearchToTsquery } from '@internal/target-postgres/full-text';
import { createCollectionMethodsOrm } from './collection-methods-orm-fixture';

const { plain } = createCollectionMethodsOrm();
const q = websearchToTsquery('alice');
plain.User.using.search(q);
plain.Post.using.users_search(q);
`;

function fixtureDiagnostics(): string[] {
  const config = ts.getParsedCommandLineOfConfigFile(
    resolve(testDir, '../tsconfig.json'),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    },
  );
  if (!config) throw new Error('tsconfig.json could not be read');
  const options = { ...config.options, noEmit: true };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.readFile = (file) => (file === fixturePath ? fixture : readFile(file));
  host.fileExists = (file) => file === fixturePath || fileExists(file);
  const program = ts.createProgram([fixturePath], options, host);
  const source = program.getSourceFile(fixturePath);
  if (source === undefined) throw new Error('fixture not in program');
  return [
    ...program.getSyntacticDiagnostics(source),
    ...program.getSemanticDiagnostics(source),
  ].map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
}

describe('a missing collection method', () => {
  it('is reported as a property missing from CollectionMethods of the model', () => {
    const diagnostics = fixtureDiagnostics();
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0]).toMatch(
      /^Property 'search' does not exist on type 'CollectionMethods<Contract, "User", "public", /,
    );
    expect(diagnostics[1]).toMatch(
      /^Property 'users_search' does not exist on type 'CollectionMethods<Contract, "Post", "public", /,
    );
  });
});
