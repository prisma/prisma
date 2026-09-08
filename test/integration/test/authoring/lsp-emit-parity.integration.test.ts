import { copyFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { timeouts } from '@repo/test-utils';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';
import { resolveConfigInputs } from '../../../../packages/1-framework/3-tooling/language-server/src/config-resolution';
import { createProjectArtifacts } from '../../../../packages/1-framework/3-tooling/language-server/src/project-artifacts';
import { withTempDir } from '../utils/cli-test-helpers';
import { runContractEmit, setupJourney } from '../utils/journey-test-helpers';

const schema = `// use prisma-next

model User {
  id        Int @id @default(autoincrement())
  email     String @unique
  username  String?
  name      String?
  posts     Post[]
  createdAt TimestamptzString @default(now())
  updatedAt temporal.updatedAtString()
}

model Post {
  id        Int @id @default(autoincrement())
  title     String
  content   String?
  author    User @relation(fields: [authorId], references: [id])
  authorId  Int
  createdAt TimestamptzString @default(now())
  updatedAt temporal.updatedAtString()
}
`;

const configPath = join(
  import.meta.dirname,
  '../fixtures/cli/cli-test-app/fixtures/lsp-emit-parity/prisma.config.ts',
);

withTempDir(({ createTempDir }) => {
  describe('language-server diagnostics with a project-installed interpreter', () => {
    it.each([
      {
        name: 'init schema',
        text: schema,
        exitCode: 0,
        diagnosticCodes: [],
      },
      {
        name: 'literal defaults and mapped names',
        text: `// use prisma-next
model Widget {
  id Int @id @default(autoincrement())
  label String @default("draft") @map("display_label")
  count Int @default(42)
  enabled Boolean @default(true)
  @@map("widgets")
}`,
        exitCode: 0,
        diagnosticCodes: [],
      },
      {
        name: 'invalid default functions',
        text: schema.replaceAll('autoincrement()', 'unknown()'),
        exitCode: 2,
        diagnosticCodes: ['PSL_INVALID_ATTRIBUTE_SYNTAX', 'PSL_INVALID_ATTRIBUTE_SYNTAX'],
      },
    ])(
      'agrees with emit for $name across the internal/public parser boundary',
      async ({ text, exitCode, diagnosticCodes }) => {
        const ctx = setupJourney({ createTempDir, contractMode: 'psl' });
        const schemaPath = join(ctx.testDir, 'contract.prisma');
        const uri = pathToFileURL(schemaPath).href;
        writeFileSync(schemaPath, text);
        copyFileSync(configPath, ctx.configPath);

        const emitted = await runContractEmit(ctx);
        expect(emitted.exitCode, emitted.stderr).toBe(exitCode);

        const resolution = await resolveConfigInputs(ctx.configPath);
        expect(resolution.interpretation).toBeDefined();
        const project = createProjectArtifacts({
          ...resolution,
          getText: (inputUri) => (inputUri === uri ? text : undefined),
        });
        const document = project.document(uri);
        expect(document).toBeDefined();
        expect(document?.diagnostics).toEqual([]);
        expect(document?.interpretDiagnostics().map((diagnostic) => diagnostic.code)).toEqual(
          diagnosticCodes,
        );
      },
      timeouts.coldTransformImport,
    );
  });
});
