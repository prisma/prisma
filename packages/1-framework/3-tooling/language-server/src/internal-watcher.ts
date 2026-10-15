import { lstat } from 'node:fs/promises';
import { dirname, parse, resolve, sep } from 'node:path';
import { contractInputDirectory } from '@internal/config/config-types';
import { structuredError } from '@internal/utils/structured-error';
import { FSWatcher } from 'chokidar';

interface WatchCallbacks {
  readonly onReady: () => void;
  readonly onChange: (path: string) => void;
  readonly onError: (error: unknown) => void;
}

export async function watchRoots(inputs: readonly string[]): Promise<string[]> {
  const roots: string[] = [];
  for (const input of inputs) {
    const directory = contractInputDirectory(sep === '\\' ? input.replaceAll('\\', '/') : input);
    let root = resolve(directory);
    while (true) {
      if (root === parse(root).root)
        throw structuredError(
          'LSP.WATCH_UNAVAILABLE',
          `Refusing recursive filesystem root watch: ${root}`,
        );
      try {
        const stats = await lstat(root);
        if (stats.isDirectory()) break;
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      }
      root = dirname(root);
    }
    roots.push(root);
  }
  return [...new Set(roots)];
}

export class InternalWatcher {
  readonly #config: FSWatcher;
  readonly #callbacks: WatchCallbacks;
  #schema: FSWatcher | undefined;
  #roots: readonly string[] = [];
  #updating = Promise.resolve();
  #closed = false;

  constructor(configPath: string, inputs: readonly string[], callbacks: WatchCallbacks) {
    this.#callbacks = callbacks;
    this.#config = this.#create({
      depth: 0,
      ignored: (path) => path !== dirname(configPath) && path !== configPath,
    });
    this.#config.add(dirname(configPath));
    void this.update(inputs);
  }

  update(inputs: readonly string[]): Promise<void> {
    this.#updating = this.#updating
      .then(async () => {
        const roots = await watchRoots(inputs);
        if (
          this.#closed ||
          (roots.length === this.#roots.length &&
            roots.every((root, index) => root === this.#roots[index]))
        )
          return;
        await this.#schema?.close();
        this.#schema = undefined;
        this.#roots = roots;
        if (!this.#closed && roots.length > 0) {
          this.#schema = this.#create();
          this.#schema.add(roots);
        }
      })
      .catch(this.#callbacks.onError);
    return this.#updating;
  }

  #create(options: ConstructorParameters<typeof FSWatcher>[0] = {}): FSWatcher {
    const watcher = new FSWatcher({
      persistent: false,
      ignoreInitial: true,
      usePolling: false,
      followSymlinks: false,
      ...options,
    });
    watcher.on('error', this.#callbacks.onError);
    watcher.on('all', (_event, path) => {
      if (!this.#closed) this.#callbacks.onChange(path);
    });
    watcher.on('ready', () => {
      if (!this.#closed) this.#callbacks.onReady();
    });
    return watcher;
  }

  async close(): Promise<void> {
    this.#closed = true;
    await this.#updating;
    await Promise.all([this.#config.close(), this.#schema?.close()]);
  }
}
