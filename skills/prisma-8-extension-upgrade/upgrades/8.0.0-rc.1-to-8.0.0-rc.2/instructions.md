---
from: "8.0.0-rc.1"
to: "8.0.0-rc.2"
changes: []
---

# 8.0.0-rc.1 → 8.0.0-rc.2 — Extension-author upgrade instructions

<!--
PR #29910: `changes: []`. Binding internal mutation-reload filters and repairing Supabase runtime coverage after the driver SPI split require no downstream extension source translation.

PR #29920: `changes: []`. Adds prepared-statement test coverage to the Supabase runtime suite (test-fixture codec registration only) and fixes a postgres direct-driver transaction defect; neither requires downstream extension source translation. The SPI split itself is recorded as `driver-spi-splits-query-and-execute` in the 0.17-to-8.0.0-rc.1 transition.

PR #29902: `changes: []`. Generated contracts gain additive aggregate rows for new opt-in integer representation codecs, but existing extension schemas and source require no migration; extension authors re-emit only when adopting the new target-scoped types.
-->
