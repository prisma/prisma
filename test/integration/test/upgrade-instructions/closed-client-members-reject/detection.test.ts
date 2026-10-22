import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';

const GUIDE_PATHS = {
  app: 'upgrade-instructions/pending/closed-client-members-reject/app/instructions.md',
  extension: 'upgrade-instructions/pending/closed-client-members-reject/extension/instructions.md',
} as const;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const id = 'client-members-reject-instead-of-throwing';

function detects(audience: keyof typeof GUIDE_PATHS, content: string): boolean {
  const guide = readFileSync(join(repoRoot, GUIDE_PATHS[audience]), 'utf-8');
  const entry = guide.split(/\n {2}- id: /).find((block) => block.startsWith(`${id}\n`));
  if (entry === undefined) throw new Error(`The ${audience} guide has no change ${id}`);
  const patterns = [...entry.matchAll(/^ {8}- '(.*)'$/gm)].map(
    ([, pattern]) => new RegExp((pattern ?? '').replaceAll("''", "'")),
  );
  if (patterns.length === 0) throw new Error(`The ${audience} change ${id} has no detection`);
  return patterns.some((pattern) => pattern.test(content));
}

describe.each(['app', 'extension'] as const)('the %s detection', (audience) => {
  it.each([
    [
      'an unawaited transaction',
      'try {\n  db.transaction(work);\n} catch (error) {\n  log(error);\n}',
    ],
    [
      'a result kept in a variable',
      'try {\n  const rows = db.query(plan);\n  use(rows);\n} catch {}',
    ],
    ['a returned prepare', 'try {\n  return db.prepare({}, build);\n} catch (e) {}'],
    [
      'a prepared execute after another statement',
      'try {\n  setUp();\n  prepared.execute(tx, params);\n} finally {\n  done();\n}',
    ],
    [
      'a nested block before the call',
      'try {\n  if (ready) { log(1); }\n  db.execute(plan);\n} catch {}',
    ],
  ])('finds %s', (_name, content) => {
    expect(detects(audience, content)).toBe(true);
  });

  it.each([
    ['an awaited query', 'try {\n  await db.query(plan).toArray();\n} catch (error) {}'],
    [
      'an awaited result in a variable',
      'try {\n  const stats = await db.execute(plan);\n} catch {}',
    ],
    ['a call outside try', 'db.transaction(work).catch(handle);'],
    ['another method', 'try {\n  cache.get(key);\n} catch {}'],
  ])('skips %s', (_name, content) => {
    expect(detects(audience, content)).toBe(false);
  });
});
