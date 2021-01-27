// - name: Run benchmark
//         run: yarn ts-node src/__tests__/integration/happy/exhaustive-schema/exhaustive-schema.bench.ts | tee output.txt
//         working-directory: src/packages/client

import execa from "execa";
import globby from "globby";
import path from "path";

async function main() {
  const benchmarks = await globby("./src/packages/**/*.bench.ts", {
    gitignore: true
  });
  await run(benchmarks);
}
async function run(benchmarks: string[]) {
  for (const location of benchmarks) {
    await execa.command(`yarn ts-node ${location}`, {
      cwd: path.join(__dirname, `..`),
      stdio: "inherit"
    });
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});