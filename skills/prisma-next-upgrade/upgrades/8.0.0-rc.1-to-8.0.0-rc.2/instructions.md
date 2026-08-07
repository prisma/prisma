---
from: "8.0.0-rc.1"
to: "8.0.0-rc.2"
changes: []
---

# 8.0.0-rc.1 → 8.0.0-rc.2 — User upgrade instructions

<!--
PR #29910: `changes: []`. The example changes repair test instrumentation and fixture/runtime isolation after the driver SPI split; they require no user API, contract, configuration, generated-artifact, or source translation.
PR #29902: `changes: []`. Generated contracts gain additive aggregate rows for new opt-in integer representation codecs, but existing schemas and source require no migration; users re-emit only when adopting the new target-scoped types.
-->
