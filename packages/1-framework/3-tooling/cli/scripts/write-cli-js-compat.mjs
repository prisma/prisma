import { chmodSync, writeFileSync } from 'node:fs';
import { resolve } from 'pathe';

const cliJsPath = resolve(process.cwd(), 'dist', 'cli.js');
const cliMjsPath = resolve(process.cwd(), 'dist', 'cli.mjs');

const shim = `#!/usr/bin/env node
import './cli.mjs';
`;

writeFileSync(cliJsPath, shim, 'utf8');
chmodSync(cliJsPath, 0o755);
chmodSync(cliMjsPath, 0o755);
