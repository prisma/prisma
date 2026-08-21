#!/usr/bin/env bash
set -euo pipefail

repo="prisma/prisma"
workflow="CI (PR)"
branch="$(git branch --show-current)"

if [[ "$branch" != autoresearch/* ]]; then
  echo "Refusing to benchmark from non-autoresearch branch: $branch" >&2
  exit 1
fi

# Each hosted-CI measurement needs a distinct head SHA. Include the current
# candidate and the prior experiment log in that SHA, then push it to the
# temporary draft PR.
git add -A
git commit --signoff --allow-empty -m "autoresearch: measure Test CI $(date -u +%Y%m%dT%H%M%SZ)" >/dev/null
sha="$(git rev-parse HEAD)"
git push --set-upstream origin "$branch" >/dev/null

pr_number="$(gh pr list --repo "$repo" --state open --head "$branch" --json number --jq '.[0].number // empty')"
if [[ -z "$pr_number" ]]; then
  pr_url="$(gh pr create --repo "$repo" --base main --head "$branch" --draft --title "autoresearch: speed up Test CI job" --body $'Temporary draft PR for hosted-CI performance experiments.\n\nDo not review or merge. The final result will be prepared separately.')"
  pr_number="${pr_url##*/}"
fi
echo "Benchmarking PR #$pr_number at $sha" >&2

run_id=""
for _ in $(seq 1 60); do
  run_id="$(gh run list --repo "$repo" --workflow "$workflow" --event pull_request --commit "$sha" --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
  [[ -n "$run_id" ]] && break
  sleep 5
done
if [[ -z "$run_id" ]]; then
  echo "Timed out waiting for the CI run for $sha" >&2
  exit 1
fi
echo "CI run: https://github.com/$repo/actions/runs/$run_id" >&2

jobs_file="$(mktemp)"
trap 'rm -f "$jobs_file"' EXIT
for _ in $(seq 1 180); do
  gh run view "$run_id" --repo "$repo" --json jobs > "$jobs_file"
  status="$(node -e '
    const fs = require("node:fs");
    const jobs = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).jobs;
    const job = jobs.find(({ name }) => name === "Test");
    process.stdout.write(job?.status ?? "waiting");
  ' "$jobs_file")"
  [[ "$status" == "completed" ]] && break
  sleep 10
done

node - "$jobs_file" "$run_id" <<'NODE'
const fs = require('node:fs');
const [jobsPath, runId] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8')).jobs;
const job = jobs.find(({ name }) => name === 'Test');
if (!job) throw new Error('The Test job did not appear');
if (job.status !== 'completed') throw new Error(`The Test job did not complete: ${job.status}`);

const seconds = (start, end) => (Date.parse(end) - Date.parse(start)) / 1000;
const step = (name) => {
  const value = job.steps.find(({ name: stepName }) => stepName === name);
  if (!value?.startedAt || !value?.completedAt) throw new Error(`Missing timing for step: ${name}`);
  return seconds(value.startedAt, value.completedAt);
};

if (job.conclusion !== 'success') {
  console.error(`Test job conclusion: ${job.conclusion}`);
  for (const value of job.steps.filter(({ conclusion }) => conclusion === 'failure')) {
    console.error(`Failed step: ${value.name}`);
  }
  process.exit(1);
}

const coverageStart = job.steps.find(({ name }) => name === 'Test packages with coverage')?.startedAt;
if (!coverageStart) throw new Error('Missing package coverage start time');

console.log(`METRIC ci_test_seconds=${seconds(job.startedAt, job.completedAt)}`);
console.log(`METRIC packages_coverage_seconds=${step('Test packages with coverage')}`);
console.log(`METRIC examples_seconds=${step('Test examples')}`);
console.log(`METRIC startup_seconds=${seconds(job.startedAt, coverageStart)}`);
console.log(`METRIC ci_run_id=${runId}`);
NODE
