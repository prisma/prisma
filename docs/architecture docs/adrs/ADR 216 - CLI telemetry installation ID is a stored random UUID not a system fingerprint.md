# ADR 216 — CLI telemetry installation ID is a stored random UUID, not a system fingerprint

## Status

Accepted. CLI telemetry is implemented as described in [`docs/Telemetry.md`](../../Telemetry.md), which is the user-facing reference for the installation ID's lifecycle and the consent surface this ADR scopes. This ADR scopes only the CLI usage telemetry installation identifier; it does not concern the existing runtime telemetry surface in [ADR 024 — Telemetry Schema](./ADR%20024%20-%20Telemetry%20Schema.md), which is an internal query-execution observability SPI with no client-stored identifier.

## At a glance

The CLI persists a small JSON config file under the user's config directory (`$XDG_CONFIG_HOME/prisma-next/config.json` on Unix per the XDG Base Directory Specification, defaulting to `~/.config/prisma-next/config.json` when `$XDG_CONFIG_HOME` is unset; platform-equivalent under `%APPDATA%` on Windows) that records a v4 random installation UUID (`installationId: string`) and, when the user has made an explicit choice, their telemetry preference (`enableTelemetry: boolean`). The UUID is minted on the **first enabled send** — the first command that resolves to telemetry-enabled and has no id stored yet — by the parent fire path (`ensureInstallationId`), and reused thereafter as the deduplication key for monthly-active-user counts. Because telemetry is opt-out by default (see [ADR 223 — CLI telemetry defaults to opt-out with a first-run notice](./ADR%20223%20-%20CLI%20telemetry%20defaults%20to%20opt-out%20with%20a%20first-run%20notice.md)), that first enabled send is reached without any prior `enableTelemetry: true` persist; the explicit `prisma-next init` consent prompt also mints the id when answered affirmatively. The value is not derived from any system identifier (no MAC address, no `/etc/machine-id`, no Windows MachineGuid, no IORegistry UUID, no hostname). Editing or deleting the file resets the relevant fields; the CLI never deletes it implicitly.

```text
~/.config/prisma-next/config.json
└── {
      "installationId": "7f1e1d6c-3b2a-4c5e-9f0d-1a2b3c4d5e6f"   // v4 random, opaque
      // enableTelemetry omitted on the default-on path; present only on an
      // explicit choice (init consent prompt, or a hand-edited opt-out).
    }
```

The trust posture is *we count installations*, not *we identify your machine*. The id is opaque, system-independent, and resettable by deleting one file. (Whether telemetry is collected at all is the opt-out question owned by [ADR 223](./ADR%20223%20-%20CLI%20telemetry%20defaults%20to%20opt-out%20with%20a%20first-run%20notice.md); this ADR scopes only what the dedup identifier *is*, not when it fires.)

## Context

The CLI Telemetry project's Phase 1 ships monthly-active-user (MAU) analytics for an OSS data tool. MAU requires per-machine deduplication: events from one developer's repeated invocations should collapse to one user. The choice of *what to use as the dedup key* is the load-bearing trust decision in the entire project.

Two compositions are available in the wild:

| Composition | Stability | Reset story | Trust posture |
|---|---|---|---|
| **System-derived fingerprint** — hashed MAC address, `/etc/machine-id`, IORegistry hardware UUID, Windows MachineGuid, or a combination | Survives reinstall, container rebuild, package removal | Hard to reset; user would need to spoof low-level system state | *We identify your machine* |
| **Stored random UUID** — generated once and persisted to a known file in the user's config directory | Tied to the installation, not the hardware; resets on container rebuild or file deletion | Trivial reset (`rm` one file); fully inspectable | *We count installations* |

Both produce usable MAU numbers. The system-derived option is technically the more precise dedup key — it correctly collapses a developer who uses multiple cloned repos on the same laptop into one user, and survives a `~/.config` wipe. But that precision is bought at a meaningful trust cost:

1. **Tracking-identifier optics.** A stable per-machine hashed identifier is, operationally, a tracking ID. The hash makes it irreversible but does not change its function: it enables longitudinal correlation of a single machine across sessions, and across other features that might one day join on it. OSS communities reliably push back on this regardless of the implementer's stated intent — "anonymous fingerprint" is a phrase that has triggered backlash threads for multiple comparable tools.

2. **Regulatory ambiguity.** GDPR jurisprudence has classified hashed MAC addresses as personal data in some EU jurisdictions, because they identify a device that can in practice be associated with a single individual. A stored random UUID is intended to avoid identifying a person and is less likely to constitute personal data than device fingerprints (e.g., hashed MAC addresses), but this should be confirmed by legal counsel; a formal legal review/DPIA is the appropriate venue for final determination.

3. **Reset asymmetry.** A user who wants to reset a system-derived fingerprint has no practical path (spoofing low-level identifiers is unreasonable to require). A user who wants to reset a stored UUID deletes one file. The resetability is the trust feature, not a defect.

4. **One-way door at first release.** Shipping a system fingerprint and replacing it later is a near-impossible reputational unwind — the community remembers what was shipped first. Shipping a stored UUID and tightening later (if tighter precision ever becomes load-bearing) is a normal change.

Three alternatives were considered during the design discussion:

- **Hashed MAC / `machine-id` / IORegistry UUID** — gives the most stable dedup key but inherits the trust costs above. Rejected.
- **Per-project UUID** — generated in `.prisma-next/installation-id` inside the user's project rather than in their home config dir. Considered briefly. Rejected because (a) it inflates MAU when one developer uses multiple repos, (b) it would need to be added to `.gitignore` to avoid being committed and shared with teammates (with all the support burden that implies), and (c) container-rebuild noise is already an acceptable trade-off at the home-config-dir level.
- **No identifier; report only sessions, exclude CI** — discussed as the "ship-the-band-aid-later" option. Sufficient for "is anyone using this" but not for MAU. Rejected because MAU will be needed eventually and the trust cost of adding an identifier *later* is roughly identical to adding it *now*.

## Decision

### Composition

The installation ID is a v4 random UUID. It is minted on the **first enabled send** — the first command that resolves to telemetry-enabled with no id stored yet — by the parent fire path (`ensureInstallationId`), which persists the id **alone** and does not touch `enableTelemetry`. Under the opt-out default ([ADR 223](./ADR%20223%20-%20CLI%20telemetry%20defaults%20to%20opt-out%20with%20a%20first-run%20notice.md)) this is the common path; an affirmative answer to the `prisma-next init` consent prompt also mints the id (alongside the `enableTelemetry: true` it persists). No bytes of its value are derived from any system identifier. It is opaque to anyone other than the team operating the telemetry backend.

### Storage

The UUID is persisted in a single JSON file under the user's per-user config directory: `$XDG_CONFIG_HOME/prisma-next/config.json` on Unix (with `$XDG_CONFIG_HOME` defaulting to `$HOME/.config` per the XDG Base Directory Specification), and the platform-equivalent path under `%APPDATA%` on Windows. The file holds up to two fields: `installationId: string` (the UUID) and the optional `enableTelemetry: boolean` (the user's explicit choice, present only when they made one — see [ADR 223](./ADR%20223%20-%20CLI%20telemetry%20defaults%20to%20opt-out%20with%20a%20first-run%20notice.md)). Additional fields may be added in future versions; readers tolerate and writers preserve unknown fields for forward compatibility.

### Lifecycle

- The `installationId` is **created** on the first enabled send, by `ensureInstallationId` in the parent fire path, which writes `{ installationId: <new v4 UUID> }` and leaves `enableTelemetry` absent. Persisting the id alone (rather than `{ enableTelemetry: true, installationId }`) is deliberate: it keeps the opt-out default intact and leaves the interactive `init` consent prompt live, since that prompt only fires while `enableTelemetry` is `undefined`. An affirmative `init` consent answer instead writes `{ enableTelemetry: true, installationId: <new v4 UUID> }`; a negative answer writes `{ enableTelemetry: false }` without an `installationId` — the negative answer is a stored opt-out, distinguishable from the never-answered default-on state.
- On every subsequent telemetry-enabled invocation, the existing UUID is **read and reused**. The CLI does not rotate, refresh, or amend the value.
- Env-var opt-out (`PRISMA_NEXT_DISABLE_TELEMETRY`, `DO_NOT_TRACK`) is purely runtime: it suppresses the telemetry code path for that invocation and never mutates the file on disk. Because a disabled invocation never reaches the fire path, it also never mints an id.
- Flipping the stored `enableTelemetry` to `false` (via manual file edit, or the `init` prompt) updates the field but does **not** delete an `installationId` already on disk. A later opt-back-in reuses the prior UUID, preserving MAU continuity.
- Deleting the file manually is the user's full reset path. The CLI treats a missing file as the default-on, never-chosen state: the next enabled command reprints the first-run notice and mints a fresh `installationId`, and the next interactive `prisma-next init` shows the consent prompt again.

### Disclosure

The disclosure model is owned by [ADR 223](./ADR%20223%20-%20CLI%20telemetry%20defaults%20to%20opt-out%20with%20a%20first-run%20notice.md) and is opt-out: a one-time first-run stderr notice on the first enabled command, plus the interactive `prisma-next init` consent prompt (default-Yes) which substitutes for the notice on interactive init only. What matters for *this* ADR is the identifier's relationship to disclosure: the id is minted on that same first enabled send, so the notice and the mint happen together, and a disabled invocation (stored `false`, env opt-out, or CI) reaches neither. Documentation links describe the stored fields, the env-var opt-outs, and the manual-edit path for flipping the choice later.

### Out of scope

This ADR does not record the wire schema, the network endpoint, the backend storage, the field list, the sanitization rules for command/flag transmission, the subprocess isolation pattern, or the project's phase structure. The user-facing surface (consent, storage, opt-out signals) is documented at [`docs/Telemetry.md`](../../Telemetry.md); the subprocess pattern is recorded in [ADR 217 — CLI telemetry runs in a detached subprocess spawned at command start](./ADR%20217%20-%20CLI%20telemetry%20runs%20in%20a%20detached%20subprocess%20spawned%20at%20command%20start.md).

## Consequences

### Positive

- **Defensible OSS trust posture.** The value cannot be construed as a tracking identifier in any technical or regulatory sense. A reviewer or community member reading the source can confirm in a single grep that no system identifier reaches the wire.
- **Trivial reset story.** A user who wants out of MAU dedup for any reason — concern, curiosity, fresh-machine simulation — deletes one file or edits one field. The user-level `config.json` is the entire mutable consent-and-identifier state surface: one place to inspect, one place to reset.
- **Regulatory simplicity.** The telemetry pipeline is designed to avoid processing personal data, which we expect to simplify the regulatory posture relative to device-fingerprint approaches. Whether a DPIA or other data-protection assessment is required is a question for legal counsel; a formal legal review/DPIA before EA launch is the appropriate venue for that determination.
- **No filesystem-mutation-on-config-change surface.** Env-var opt-out is purely "don't enter the branch"; the CLI never deletes or mutates the user-level config file in response to an env-var change. The writes that touch the file are the explicit-choice writes (the `init` consent prompt's confirm) and the first-enabled-send `installationId` mint — and the mint only ever *adds* the id, never removes or overwrites a `enableTelemetry` the user set. This avoids an entire class of accidents where a runtime setting change implicitly deletes filesystem state the user wanted to keep.
- **Resettable, system-independent identifier.** Telemetry is opt-out by default (the posture decision lives in [ADR 223](./ADR%20223%20-%20CLI%20telemetry%20defaults%20to%20opt-out%20with%20a%20first-run%20notice.md)); whatever the default, the identifier this ADR specifies stays a stored random UUID that a reviewer can confirm in one grep is derived from no system state, and that a user can clear by deleting one file. The trust property — *the dedup key is not a machine fingerprint* — is independent of when the key is minted, so the opt-in→opt-out flip does not weaken it.
- **One-way door avoided.** A future tightening (e.g. additional dedup signal joined alongside the UUID) is open. A future loosening (dropping the UUID entirely) is also open. The system-derived alternative would have closed both.

### Trade-offs

- **MAU noise from container/reinstall.** A developer who routinely uses fresh containers or who reinstalls their OS counts as multiple users. The expected error margin is bounded by the team's container/reinstall patterns and is well below the precision needed for the EA-stage questions ("is adoption growing?", "which runtime distribution?"). Accepted explicitly during the design discussion.
- **Shared-laptop edge case.** Two developers on one machine sharing the same user account share one installation ID. They appear as one MAU. The team has judged this acceptable for an OSS tool where the multi-user-per-machine pattern is rare in practice.
- **No native deduplication across project clones.** A developer who clones the same project to `~/work/proj` and `~/work/proj-copy` is correctly deduped (same `~/.config/prisma-next/config.json`). A developer who uses two separate user accounts on one machine is not. Accepted.

### Non-goals

- **System-fingerprint dedup is not a future v2 enhancement under consideration.** Adding it later would be a one-way trust unwind. If precision pressure ever justifies revisiting, this ADR must be revisited explicitly, not silently extended.
- **No identifier rotation.** The UUID, once generated, is permanent for the lifetime of the file. We do not refresh on a schedule, on backend migration, or on Prisma Next version change. Identifier stability is the dedup story; rotation would defeat MAU.
- **No proof-of-uniqueness on the backend.** Two clients are free to send the same UUID (deliberately or by collision). The backend trusts the wire; it does not attempt to verify that two events with the same UUID originated from the same installation. Collisions on a v4 random UUID are statistically irrelevant at any plausible adoption scale.

## Alternatives considered

- **Hashed MAC address.** Rejected on trust optics, GDPR jurisprudence, and reset asymmetry. The "anonymous because hashed" framing has not held up in OSS reviews for comparable tools.
- **`/etc/machine-id` (Linux) / IORegistry UUID (macOS) / Windows MachineGuid.** OS-provided "anonymous machine identifier" values. Rejected for the same reasons as hashed MAC, with the added concern that these values often persist across OS reinstalls when system snapshots are restored, making the dedup "too sticky" relative to the actual install/uninstall lifecycle we want to track.
- **Per-project `.prisma-next/installation-id`.** Rejected — inflates MAU per repo, leaks into VCS without a `.gitignore` entry the user must remember, complicates the consent story (does cloning a teammate's repo enrol you?).
- **Random UUID stored in OS keychain (`keytar`-style).** Rejected — adds a heavyweight dependency and an OS-keychain dependency to a CLI that should run on minimal systems. Trust-equivalent to the file-based approach; complexity not justified.
- **No identifier at all; report session count with CI excluded.** Discussed during design as the "ship-the-band-aid-later" option. Sufficient for "is anyone using this" but not for MAU. Rejected because MAU is already on the EA-stage requirements list.
