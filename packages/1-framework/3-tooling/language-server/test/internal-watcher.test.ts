import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  await mkdir(join(dir, '{one'));
  expect(await watchRoots([join(dir, '{one/nested,two}/**/*.prisma')])).toEqual([dir]);
  await expect(watchRoots([`${dir}/*/../../*.prisma`])).rejects.toThrow('traversal');
});
it('keeps literal parent traversal and external roots available', async () => {
  const dir = await directory();
  await mkdir(join(dir, 'config'));
  await mkdir(join(dir, 'outside'));
  expect(await watchRoots([`${dir}/config/../outside/schema.prisma`])).toEqual([
    join(dir, 'outside'),
  ]);
  await expect(watchRoots([`${dir}/config/../outside/**/*.prisma`])).rejects.toThrow('traversal');
});

it.each(['*', '?', '[unfinished', '{literal}', '@(one|two)', '!(one)', '\\[id\\]'])(
  'uses a conservative root boundary for %s outside the config directory',
  async (segment) => {
    const dir = await directory();
    await mkdir(join(dir, segment));
    expect(await watchRoots([join(dir, segment, 'nested/schema.prisma')])).toEqual([dir]);
    await expect(watchRoots([`${dir}/${segment}/../../schema.prisma`])).rejects.toThrow(
      'traversal',
    );
  },
);
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
it('observes real external changes and atomic config replacement', async () => {
  const dir = await directory();
  const schemas = join(dir, 'schemas');
  await mkdir(schemas);
  const config = join(dir, 'prisma.config.ts');
  await writeFile(config, 'first');
  const onReady = vi.fn();
  const onChange = vi.fn();
  const onError = vi.fn();
  const watcher = new InternalWatcher(config, [join(schemas, '**/*.prisma')], {
    onReady,
    onChange,
    onError,
  });
  cleanups.push(() => watcher.close());
  await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce());
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
