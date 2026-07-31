#!/usr/bin/env node
// The shim's whole dist: a launcher for the one published copy of the CLI.
//
// ADR 211 built this package by copying `@prisma-next/cli`'s dist verbatim,
// which worked while that package was itself published — the copy's imports
// of `@prisma-next/*` resolved from the shim's own mirrored dependencies.
// Those packages are private now (ADR 242), so a verbatim copy would import
// names that do not exist on the registry, and re-bundling the CLI into the
// shim would put a second copy of the program on disk beside
// `@prisma/orm-toolchain`'s. Launching the toolchain's copy is the shape ADR
// 211 anticipated as its "Flavor 2" upgrade, and it is non-breaking: the
// shim's public surface is a bin and nothing else, exactly as before.

import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'pathe';

const LAUNCHER = "#!/usr/bin/env node\nimport '@prisma/orm-toolchain/bin/prisma-next';\n";

const shimDist = resolve(import.meta.dirname, '../dist');

await rm(shimDist, { recursive: true, force: true });
await mkdir(shimDist, { recursive: true });

const cli = resolve(shimDist, 'cli.js');
await writeFile(cli, LAUNCHER);
// `cp` preserved mode bits before; a freshly written file needs the execute
// bit applied, and some filesystems (CI sandboxes, Windows-backed FAT/NTFS)
// drop it regardless.
await chmod(cli, 0o755);

console.log(`[prisma-next build] Wrote ${cli}`);
