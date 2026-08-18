#!/bin/bash
set -euo pipefail

output_file=".auto/last-measurement.log"
jobs_file="$(mktemp)"
trap 'rm -f "$jobs_file"' EXIT

head_sha="$(git rev-parse HEAD)"
run_id="${CI_RUN_ID:-}"
if [[ -z "$run_id" ]]; then
  run_id="$(
    gh run list \
      --workflow 'CI (PR)' \
      --branch autoresearch/integration-suite-speed-2026-08-18 \
      --limit 10 \
      --json databaseId,headSha \
      | jq -r --arg head "$head_sha" '.[] | select(.headSha == $head) | .databaseId' \
      | head -1
  )"
fi

if [[ -z "$run_id" ]]; then
  echo "No CI run found for $head_sha" >&2
  exit 1
fi

echo "CI_RUN_ID=$run_id"
gh run watch "$run_id" --compact --interval 30
gh api "repos/prisma/prisma/actions/runs/$run_id/jobs?per_page=100" > "$jobs_file"

python3 - "$jobs_file" <<'PY'
import json
import sys
from datetime import datetime

with open(sys.argv[1]) as file:
    jobs = json.load(file)["jobs"]

shards = [job for job in jobs if job["name"].startswith("Integration Tests (")]
if len(shards) != 3 or any(job["conclusion"] != "success" for job in shards):
    states = [(job["name"], job["conclusion"]) for job in shards]
    raise SystemExit(f"Expected three successful integration shards, got {states}")

def seconds(start: str, end: str) -> float:
    start_at = datetime.fromisoformat(start.replace("Z", "+00:00"))
    end_at = datetime.fromisoformat(end.replace("Z", "+00:00"))
    return (end_at - start_at).total_seconds()

job_seconds = max(seconds(job["started_at"], job["completed_at"]) for job in shards)
step_seconds = []
for job in shards:
    step = next(step for step in job["steps"] if step["name"] == "Run Integration tests")
    step_seconds.append(seconds(step["started_at"], step["completed_at"]))

print(f"METRIC ci_integration_critical_path_seconds={job_seconds:.0f}")
print(f"METRIC ci_integration_step_seconds={max(step_seconds):.0f}")
for job in shards:
    print(f"SHARD_JOB_ID={job['id']}")
PY

: > "$output_file"
while IFS='=' read -r key job_id; do
  [[ "$key" == "SHARD_JOB_ID" ]] || continue
  gh run view "$run_id" --job "$job_id" --log >> "$output_file"
done < <(python3 - "$jobs_file" <<'PY'
import json
import sys
with open(sys.argv[1]) as file:
    jobs = json.load(file)["jobs"]
for job in jobs:
    if job["name"].startswith("Integration Tests ("):
        print(f"SHARD_JOB_ID={job['id']}")
PY
)

test_files="$(grep 'Test Files' "$output_file" | sed -E 's/.*\(([0-9]+)\).*/\1/' | awk '{ total += $1 } END { print total + 0 }')"
tests="$(grep -E 'Tests .*passed' "$output_file" | grep -v 'Test Files' | sed -E 's/.*\(([0-9]+)\).*/\1/' | awk '{ total += $1 } END { print total + 0 }')"

printf 'METRIC test_files=%s\n' "$test_files"
printf 'METRIC tests=%s\n' "$tests"
