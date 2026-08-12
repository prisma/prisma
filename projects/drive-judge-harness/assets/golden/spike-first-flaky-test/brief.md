# Brief — fix the flaky integration test

One of our integration tests fails intermittently — maybe 1 run in 10 — with a timeout. It passes on re-run, so CI is mostly green, but the noise is eroding trust in the suite and occasionally blocks merges.

We don't know the root cause. It could be a real race in the code under test, a test-ordering / shared-state issue, an under-provisioned timeout, or a resource-startup flake (the in-memory server / DB warm-up). Different causes need very different fixes — and the wrong fix (e.g. just bumping the timeout, or quarantining the test) could mask a real bug.

Please get the suite reliably green again.
