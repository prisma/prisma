import { execSync } from 'node:child_process';
import { text } from 'node:stream/consumers';

const hook = JSON.parse(await text(process.stdin));
const filePath = hook.tool_input?.file_path;
if (filePath?.endsWith('.ts')) {
  execSync(`pnpm biome format --write ${filePath}`, { cwd: hook.cwd, stdio: 'inherit' });
}
