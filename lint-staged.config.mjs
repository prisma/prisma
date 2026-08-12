// biome-plugins/fixtures/** contains intentional rule-violation fixtures for the
// no-bare-cast GritQL plugin. They must be present on disk so the validation
// gates (`pnpm biome lint <fixture>`) can exercise the plugin end-to-end, but
// they would otherwise trip the pre-commit `biome check` on every commit that
// touches them. Filter them out at the lint-staged layer rather than at the
// biome layer (excluding them in biome.jsonc files.includes would also block
// the validation gates).
const excludeFixtures = (files) => files.filter((f) => !f.includes('biome-plugins/fixtures/'));

const formatAndCheck = (files) => {
  const filtered = excludeFixtures(files);
  if (filtered.length === 0) return [];
  const quoted = filtered.map((f) => `"${f}"`).join(' ');
  return [
    `biome format --write --no-errors-on-unmatched ${quoted}`,
    `biome check --write --no-errors-on-unmatched ${quoted}`,
  ];
};

const lintDeps = (files) => {
  const filtered = excludeFixtures(files);
  if (filtered.length === 0) return [];
  const quoted = filtered.map((f) => `"${f}"`).join(' ');
  return [`node scripts/lint-deps-focused.mjs ${quoted}`];
};

export default {
  '*.{ts,tsx,js,jsx,mjs,json,jsonc,css}': formatAndCheck,
  '*.{ts,tsx,js,jsx}': lintDeps,
};
