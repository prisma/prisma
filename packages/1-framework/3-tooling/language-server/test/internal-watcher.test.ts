import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildLoadedConfig, requireConfigSections } from '@internal/config-loader';
import { FSWatcher } from 'chokidar';
import { afterEach, expect, it, vi } from 'vitest';
import { InternalWatcher, watchRoots } from '../src/internal-watcher';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup();
  cleanups.length = 0;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function directory() {
  const dir = await mkdtemp(join(tmpdir(), 'internal-watcher-'));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
it('derives literal safe roots for glob syntax and future directories', async () => {
  const dir = await directory();
  await mkdir(join(dir, 'schemas'));
  expect(
    await watchRoots([
      join(dir, 'schemas/@(user|post)/*.prisma'),
      join(dir, 'schemas/{one,two}/**/*.prisma'),
      join(dir, 'schemas/[[]id[]]/schema.prisma'),
      join(dir, 'schemas/[!a]/schema.prisma'),
      join(dir, 'schemas/!(user)/schema.prisma'),
      join(dir, 'schemas/{1..3}/schema.prisma'),
    ]),
  ).toEqual([join(dir, 'schemas')]);
  expect(await watchRoots([join(dir, 'missing/deeper/*.prisma')])).toEqual([dir]);
  expect(await watchRoots([join(dir, 'schema.prisma')])).toEqual([dir]);
  await expect(watchRoots(['/**/*.prisma'])).rejects.toThrow('root');
  await expect(watchRoots(['/schemas/{../outside,inside}/*.prisma'])).rejects.toThrow('root');
  await mkdir(join(dir, '{one'));
  expect(await watchRoots([join(dir, '{one/nested,two}/**/*.prisma')])).toEqual([dir]);
  expect(await watchRoots([`${dir}/*/../../*.prisma`])).toEqual([dirname(dir)]);
});
it('retains nested roots and removes only exact duplicates', async () => {
  const dir = await directory();
  const child = join(dir, 'schemas');
  await mkdir(child);
  expect(
    await watchRoots([join(child, '*.prisma'), join(dir, '*.prisma'), join(child, '**/*.prisma')]),
  ).toEqual([child, dir]);
});
it('receives resolved filesystem paths without interpreting leading exclamation marks', async () => {
  const dir = await directory();
  const schemas = join(dir, '!schemas');
  await mkdir(schemas);
  const loaded = buildLoadedConfig(
    {
      contract: {
        source: {
          format: 'psl',
          inputs: ['!schemas/*.prisma', join(dir, 'schema.prisma')],
          load: async () => undefined,
        },
      },
    },
    dir,
  );
  const result = requireConfigSections(loaded, ['contract']);
  expect(result.ok).toBe(true);
  if (!result.ok) throw result.failure;
  const inputs = result.value.contract?.source.inputs;
  expect(inputs).toEqual([join(schemas, '*.prisma'), join(dir, 'schema.prisma')]);
  expect(await watchRoots(inputs ?? [])).toEqual([schemas, dir]);
});
it('keeps literal parent traversal and external roots available', async () => {
  const dir = await directory();
  await mkdir(join(dir, 'config'));
  await mkdir(join(dir, 'outside'));
  expect(await watchRoots([`${dir}/config/../outside/schema.prisma`])).toEqual([
    join(dir, 'outside'),
  ]);
  expect(await watchRoots([`${dir}/config/../outside/**/*.prisma`])).toEqual([
    join(dir, 'outside'),
  ]);
  expect(await watchRoots([`${dir}/config/{../outside,inside}/*.prisma`])).toEqual([dir]);
});

it('resolves escaped brackets to an existing literal directory', async () => {
  const dir = await directory();
  await mkdir(join(dir, '[id]'));
  expect(await watchRoots([String.raw`${dir}/\[id\]/schema.prisma`])).toEqual([join(dir, '[id]')]);
});

it.each(['?', 'user?'])('covers every match of a %s directory', async (segment) => {
  const dir = await directory();
  await mkdir(join(dir, segment));
  expect(await watchRoots([join(dir, segment, 'nested/schema.prisma')])).toEqual([dir]);
});

it.each(['[unfinished', '{literal}'])('keeps a literal %s directory', async (segment) => {
  const dir = await directory();
  await mkdir(join(dir, segment));
  expect(await watchRoots([join(dir, segment, 'nested/schema.prisma')])).toEqual([
    join(dir, segment),
  ]);
});

it.each(['*', '@(one|two)', '!(one)', '\\[id\\]'])(
  'uses a conservative root boundary for %s outside the config directory',
  async (segment) => {
    const dir = await directory();
    await mkdir(join(dir, segment));
    expect(await watchRoots([join(dir, segment, 'nested/schema.prisma')])).toEqual([dir]);
  },
);
it.each([
  ['schemas/?/schema.prisma', ['schemas/a', 'schemas/b']],
  ['schemas/user?/schema.prisma', ['schemas/usera', 'schemas/userb']],
  ['schemas/{../outside,inside}/*.prisma', ['outside', 'schemas/inside']],
  ['schemas/*/../../outside/*.prisma', ['outside']],
  ['schemas/**/../outside/*.prisma', ['outside']],
  ['schemas/[[]id[]]/*.prisma', ['schemas/[id]']],
  [String.raw`schemas/\[id\]/*.prisma`, ['schemas/[id]']],
])('observes existing and future matches of %s', async (pattern, members) => {
  const dir = await directory();
  await mkdir(join(dir, 'config'));
  await mkdir(join(dir, 'schemas', '?'), { recursive: true });
  await mkdir(join(dir, 'schemas', 'user?'));
  const first = members[0];
  if (!first) throw new Error('Expected a fixture member');
  const existing = join(dir, first, 'schema.prisma');
  await mkdir(dirname(existing), { recursive: true });
  await writeFile(existing, 'first');
  const onReady = vi.fn();
  const onChange = vi.fn();
  const onError = vi.fn();
  const watcher = new InternalWatcher(join(dir, 'config/prisma.config.ts'), [`${dir}/${pattern}`], {
    onReady,
    onChange,
    onError,
  });
  cleanups.push(() => watcher.close());
  await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(2));
  await writeFile(existing, 'second');
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(existing));
  onChange.mockClear();
  for (const member of members) {
    const file = join(dir, member, 'schema.prisma');
    if (file !== existing) {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, 'third');
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(file));
      onChange.mockClear();
    }
    await rm(file);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(file));
    onChange.mockClear();
  }
  expect(onError).not.toHaveBeenCalled();
});

it.each([undefined, 'true'])('allows library polling configuration: %s', async (usePolling) => {
  const dir = await directory();
  vi.stubEnv('CHOKIDAR_USEPOLLING', usePolling);
  const subscriptions: FSWatcher[] = [];
  const add = vi.spyOn(FSWatcher.prototype, 'add').mockImplementation(function (this: FSWatcher) {
    subscriptions.push(this);
    this.emit('ready');
    return this;
  });
  const onError = vi.fn();
  const onReady = vi.fn();
  const watcher = new InternalWatcher(join(dir, 'prisma.config.ts'), [], {
    onReady,
    onError,
    onChange: vi.fn(),
  });
  cleanups.push(() => watcher.close());
  await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce());
  expect(add).toHaveBeenCalledOnce();
  expect(subscriptions[0]?.options.usePolling).toBe(usePolling === 'true');
  expect(subscriptions[0]?.options.awaitWriteFinish).toBe(false);
  expect(onError).not.toHaveBeenCalled();
  await watcher.close();
  expect(subscriptions[0]?.closed).toBe(true);
});
it('keeps config observation and schema coverage through parent-child root transitions', async () => {
  const dir = await directory();
  const child = join(dir, 'schemas');
  await mkdir(child);
  const config = join(dir, 'prisma.config.ts');
  await writeFile(config, 'first');
  const onReady = vi.fn();
  const onChange = vi.fn();
  const watcher = new InternalWatcher(config, [join(dir, '*.prisma')], {
    onReady,
    onChange,
    onError: (error) => {
      throw error;
    },
  });
  cleanups.push(() => watcher.close());
  await vi.waitFor(() => expect(onReady).toHaveBeenCalled());
  for (const root of [child, dir, child, dir]) {
    onReady.mockClear();
    await watcher.update([join(root, '**/*.prisma')]);
    await vi.waitFor(() => expect(onReady).toHaveBeenCalled());
    onChange.mockClear();
    const file = join(child, 'user.prisma');
    await writeFile(file, String(Math.random()));
    await writeFile(config, String(Math.random()));
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(file);
      expect(onChange).toHaveBeenCalledWith(config);
    });
  }
});

it.each([false, true])(
  'observes overlapping native roots (child first: %s)',
  async (childFirst) => {
    const dir = await directory();
    const child = join(dir, 'schemas');
    await mkdir(child);
    const roots = childFirst ? [child, dir] : [dir, child];
    const add = vi.spyOn(FSWatcher.prototype, 'add');
    const onReady = vi.fn();
    const onChange = vi.fn();
    const onError = vi.fn();
    const watcher = new InternalWatcher(
      join(dir, 'prisma.config.ts'),
      roots.map((root) => join(root, '*.prisma')),
      { onReady, onChange, onError },
    );
    cleanups.push(() => watcher.close());
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(2));
    expect(add).toHaveBeenCalledWith(roots);
    for (const root of roots) {
      const member = join(root, 'user.prisma');
      await writeFile(member, 'first');
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(member));
      onChange.mockClear();
      await writeFile(member, 'second');
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(member));
      onChange.mockClear();
      await rm(member);
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(member));
      onChange.mockClear();
    }
    expect(onError).not.toHaveBeenCalled();
  },
);

it('observes real external changes through a static parent segment and atomic config replacement', async () => {
  const dir = await directory();
  const schemas = join(dir, 'schemas');
  await mkdir(schemas);
  await mkdir(join(dir, 'config'));
  const config = join(dir, 'prisma.config.ts');
  await writeFile(config, 'first');
  const onReady = vi.fn();
  const onChange = vi.fn();
  const onError = vi.fn();
  const watcher = new InternalWatcher(config, [`${dir}/config/../schemas/**/*.prisma`], {
    onReady,
    onChange,
    onError,
  });
  cleanups.push(() => watcher.close());
  await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(2));
  const member = join(schemas, 'new.prisma');
  await writeFile(member, 'first');
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(member));
  onChange.mockClear();
  await writeFile(member, 'second');
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(member));
  await rm(config);
  await writeFile(config, 'replacement');
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(config));
  expect(onError).not.toHaveBeenCalled();
});
