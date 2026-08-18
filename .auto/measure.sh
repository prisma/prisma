#!/bin/bash
set -euo pipefail

output_file=".auto/last-measurement.log"
start_ns="$(node -e 'process.stdout.write(process.hrtime.bigint().toString())')"
pnpm --filter integration-tests test 2>&1 | tee "$output_file"
end_ns="$(node -e 'process.stdout.write(process.hrtime.bigint().toString())')"

integration_seconds="$(node -e "process.stdout.write(((BigInt('$end_ns') - BigInt('$start_ns')) / 1000000n / 1000n).toString())")"
summary="$(grep -E 'Test Files|Tests  ' "$output_file" | tail -2 || true)"
test_files="$(printf '%s\n' "$summary" | awk '/Test Files/ { for (i = 1; i <= NF; i++) if ($i == "passed") { gsub(/[^0-9]/, "", $(i-1)); print $(i-1); exit } }')"
tests="$(printf '%s\n' "$summary" | awk '/Tests/ { for (i = 1; i <= NF; i++) if ($i == "passed") { gsub(/[^0-9]/, "", $(i-1)); print $(i-1); exit } }')"

printf 'METRIC integration_seconds=%s\n' "$integration_seconds"
printf 'METRIC test_files=%s\n' "${test_files:-0}"
printf 'METRIC tests=%s\n' "${tests:-0}"
