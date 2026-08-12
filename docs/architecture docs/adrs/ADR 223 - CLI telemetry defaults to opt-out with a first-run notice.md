# ADR 223 — CLI telemetry defaults to opt-out with a first-run notice

## Status

Accepted (TML-2762). CLI telemetry is opt-out by default as described in [`docs/Telemetry.md`](../../Telemetry.md), which is the user-facing reference for the consent surface this ADR scopes. This ADR is the posture companion to [ADR 216 — CLI telemetry installation ID is a stored random UUID](./ADR%20216%20-%20CLI%20telemetry%20installation%20ID%20is%20a%20stored%20random%20UUID%20not%20a%20system%20fingerprint.md) (which scopes *what the dedup identifier is*) and [ADR 217 — CLI telemetry runs in a detached subprocess](./ADR%20217%20-%20CLI%20telemetry%20runs%20in%20a%20detached%20subprocess%20spawned%20at%20command%20start.md) (which scopes *how the event is sent*). It supersedes the opt-in default ADR 216 originally assumed; ADR 216 has been amended to point here. ADR 217 carries no opt-in/posture content — it remains the unchanged companion for *how the event is sent*.

## At a glance

Telemetry is **on unless the user turns it off**. The gate resolves to enabled whenever the stored `enableTelemetry` is `true` *or absent* (`undefined`); it resolves to disabled only when `enableTelemetry` is explicitly `false`, an env opt-out is set (`PRISMA_NEXT_DISABLE_TELEMETRY` truthy / `DO_NOT_TRACK=1`, which win over everything), or the process is in CI. On the first command that resolves enabled with no `installationId` stored, the CLI prints a one-time disclosure to stderr, mints the `installationId`, and sends. The same first-run notice is the single disclosure surface for **every** command, `init` included — there is no interactive consent prompt. A dedicated `prisma-next telemetry [status|enable|disable]` command lets the user inspect or change the preference, and is itself exempt from the usage-telemetry fire.

```text
read user config + env
        │
        ▼
  env opt-out set?  ──yes──► disabled (never mutates disk)
        │ no
        ▼
  enableTelemetry === false?  ──yes──► disabled (stored opt-out)
        │ no
        ▼
  enableTelemetry true OR undefined  ──► ENABLED
        │
        ▼
  installationId stored?  ──yes──► send (silent)
        │ no
        ▼
  print first-run notice (stderr) → mint installationId → send
```

The field **name** `enableTelemetry` is unchanged from v0.11.0. The only thing that changed is how `undefined` is interpreted: opt-in read `undefined` as off; opt-out reads it as on.

## Context

CLI usage telemetry shipped in v0.11.0 as **opt-in**: the only disclosure-and-consent surface was the interactive `prisma-next init` prompt, and telemetry was collected only after an affirmative `enableTelemetry: true` was persisted to the user config.

That gate has a structural blind spot. The `init` consent prompt fires only on an interactive TTY with no `--yes` and no env/CI opt-out. A large and product-relevant slice of real usage never crosses it:

- **Non-interactive `init`** — `--yes`, piped stdin, or `--no-interactive` — skips the prompt entirely.
- **Agent-driven runs.** AI coding agents (Claude Code, Cursor, Codex, and the rest of the allowlist in [`docs/Telemetry.md`](../../Telemetry.md#agent-detection)) drive the CLI non-interactively. The `agent` field exists specifically to measure how much usage flows through agents — but under opt-in, agent-driven runs could almost never reach an affirmative consent, so the very population the field was added to count was systematically absent from the stream.
- **`init`-skippers.** Users who scaffold by hand, copy an example, or only ever run non-`init` commands were never asked at all.

The result: the opted-in population skewed heavily toward interactive human first-runs and badly under-represented the automated and agent-driven usage the team most needs to understand for an EA-stage OSS data tool. The adoption questions in [`docs/Telemetry.md`](../../Telemetry.md#how-the-data-is-used) — MAU, target distribution, agent-vs-human split — were being answered from a biased sample.

The constraint is to widen the collected population without weakening the trust properties the project already committed to: a resettable, system-independent identifier (ADR 216), strict runtime isolation (ADR 217), no transmission of values/paths/identifiers ([`docs/Telemetry.md`](../../Telemetry.md#what-is-not-collected)), and **no silent re-enablement of users who had already opted out** under v0.11.0.

### Prior art

Opt-out-by-default with a one-time first-run disclosure is the established pattern among comparable developer CLIs, and the disclosure-plus-env-opt-out shape below is modelled on it:

- **Next.js** — telemetry is enabled by default; the CLI prints a one-time anonymous-telemetry notice on first collection and is disabled via `next telemetry disable` or `NEXT_TELEMETRY_DISABLED=1`.
- **.NET CLI** — telemetry on by default, a first-run notice on the very first command, opt-out via `DOTNET_CLI_TELEMETRY_OPTOUT=1`.
- **Homebrew** — analytics on by default, opt-out via `brew analytics off` or `HOMEBREW_NO_ANALYTICS=1`.
- **Astro** and **Nuxt** — both default-on with a first-run notice and a `… telemetry disable` / env opt-out.
- **`DO_NOT_TRACK`** — the cross-tool [community opt-out convention](https://consoledonottrack.com) we additionally honour, so a single env var opts out of every participating tool at once.

The two-signal opt-out (a tool-specific `PRISMA_NEXT_DISABLE_TELEMETRY` plus the shared `DO_NOT_TRACK`) and the stderr first-run notice mirror this prior art rather than inventing a new contract.

## Decision

### Default to opt-out

The gate (`resolveGating` in `cli-telemetry/src/gating.ts`) resolves to **enabled** when `enableTelemetry` is `true` or `undefined`, and to **disabled** only when:

1. an env opt-out is set — `PRISMA_NEXT_DISABLE_TELEMETRY` parses truthy (the falsy spellings `""`, `"0"`, `"false"` count as not-set) or `DO_NOT_TRACK=1`. These are checked first and **win** over any stored or unset preference, and never mutate disk; or
2. the stored `enableTelemetry` is explicitly `false`; or
3. the process is in CI (resolved one layer up, in the CLI's `resolveTelemetryGate`, via `ci-info`).

Absence of a stored choice (`undefined`) is the load-bearing branch: it means *on*.

### Keep the `enableTelemetry` field name

The stored field keeps its v0.11.0 name and `false` semantics. A v0.11.0 user who opted out wrote `{ "enableTelemetry": false }`; under opt-out that exact value still resolves to disabled. Honouring existing opt-outs with zero migration is the reason the field is not renamed — see *Alternatives rejected*.

### First-run notice on any command

On the first command that resolves enabled with `installationId === undefined`, the parent fire path (`discloseAndMintOnFirstRun` in `cli/src/utils/telemetry.ts`) prints a one-time disclosure to **stderr** (never stdout, so piped output is never corrupted), then mints the `installationId` and sends. This is the single disclosure surface for every command, `init` included. The notice text, with the resolved absolute config-file path substituted in, is exactly (`firstRunNotice`):

```text
Prisma Next collects anonymous CLI usage data, enabled by default. What's collected and why: https://prisma-next.dev/docs/cli/telemetry. Opt out: run "prisma-next telemetry disable", set DO_NOT_TRACK=1 or PRISMA_NEXT_DISABLE_TELEMETRY=1, or set "enableTelemetry": false in <resolved config.json path>.
```

The notice is keyed on `installationId === undefined`, so it prints exactly once: the mint that immediately follows it makes every later run silent. Both the print and the mint are wrapped best-effort — an un-writable config dir never throws and never blocks the command (on mint failure the id stays undefined, the sender no-ops on the missing id, and the notice may reprint next run).

### Single disclosure: the first-run notice for every command, plus a `telemetry` command

There is **no** interactive consent prompt. The first-run notice is the single disclosure surface, and it fires uniformly for every command — `init` is treated exactly like any other command. This is precisely the shape of the prior art cited above (Next.js, .NET, Homebrew, Astro, Nuxt): a one-time first-run notice plus a `<tool> telemetry disable` command, with no interactive yes/no prompt. The earlier draft of this ADR retained the `init` consent prompt and suppressed the notice on interactive init; folding in that prior art removed the prompt and all of its preAction-suppression machinery, leaving the notice as the only banner any command prints.

The opt-out surface is rounded out by a dedicated command, `prisma-next telemetry [status|enable|disable]` (`cli/src/commands/telemetry/`):

- `status` is read-only — it resolves the same gate the runtime uses and reports whether telemetry is on and why, the resolved user-config path, and whether an `installationId` is stored (presence only, never the value). It mints nothing and sends nothing.
- `enable` writes `enableTelemetry: true` (minting an id via the existing auto-mint); `disable` writes `enableTelemetry: false` (no id minted).

The `telemetry` command is the **only** command-specific exemption from the usage-telemetry preAction fire: `fireTelemetryFromPreAction` early-returns a no-op when the rooted command path is `telemetry`-rooted (`commandPathFor(actionCommand)[1] === 'telemetry'`), so `telemetry disable` never sends an event before disabling and `telemetry status` never mints + sends while merely reporting state. This trivial guard replaces the deleted `init`-suppression branch.

### Mint the `installationId` on first enabled send

The id is minted by `ensureInstallationId`, which persists the id **alone** and leaves `enableTelemetry` absent. Persisting only the id (rather than coupling it to an `enableTelemetry: true` write) is what keeps the opt-out default intact: a stored `enableTelemetry: true` would be an explicit-opt-in record the user never made. The identifier design is unchanged from [ADR 216](./ADR%20216%20-%20CLI%20telemetry%20installation%20ID%20is%20a%20stored%20random%20UUID%20not%20a%20system%20fingerprint.md); only its *minting trigger* moved from "first `enableTelemetry: true` persist" to "first enabled send".

### Opt-out signals

The three opt-out paths, any one sufficient, are unchanged in mechanism and now exhaustively define "off":

- `DO_NOT_TRACK=1` (community convention) or `PRISMA_NEXT_DISABLE_TELEMETRY` truthy — runtime-only, win over stored state, never touch disk;
- stored `enableTelemetry: false` in the user config;
- CI (auto-detected).

### Out of scope

This ADR does not change the wire schema, the field list, the sanitization rules, the identifier composition (ADR 216), or the subprocess isolation (ADR 217). It records only the default-posture flip and its disclosure surface.

## Consequences

### Positive

- **The collected population matches the questions.** Non-interactive, `--yes`, and agent-driven runs now contribute, so MAU, target distribution, and the agent-vs-human split are computed from a representative sample rather than the interactive-human-first-run slice.
- **Existing opt-outs are preserved with zero migration.** A v0.11.0 user with `{ "enableTelemetry": false }` stays off; the field name and `false` semantics are untouched. No legacy read, no rename, no migration step.
- **Disclosure still happens before the first send.** Opt-out does not mean undisclosed: the first enabled command prints the notice *before* the event leaves the machine, and points the user at the docs, the `prisma-next telemetry disable` command, and all the opt-out signals.
- **One disclosure surface, not two.** Removing the `init` prompt collapses disclosure to a single, uniform path. There is no prompt/notice divergence to keep in sync, no preAction suppression branch, and no per-command special-casing beyond the `telemetry` command's own fire-exemption.

### Trade-offs / things that change for users

- **Existing `undefined` installs become enabled on their next run.** A v0.11.0 user who had the CLI installed but never answered the prompt (so `enableTelemetry` is absent) is now enabled. They are not surprised silently: their next enabled command prints the first-run notice on stderr before sending, and any of the three opt-outs turns it off immediately.
- **Trust posture moves from "only opted-in" to "opt-out with disclosure".** v0.11.0's contract was "never collected without an explicit `true`". The new contract is "collected by default, disclosed on first send, trivially and permanently disablable". This is a real reduction in the strictness of the consent contract, accepted because the opt-in sample was too biased to answer the project's questions and because the identifier (ADR 216) and isolation (ADR 217) trust properties — the ones that protect the *user*, as opposed to maximizing *abstention* — are untouched.
- **An interactive user who would have declined now sends one event before they can decline.** Without the prompt, the first command of an interactive user who *would* have answered "No" prints the notice and then sends that first event before they have a chance to run `prisma-next telemetry disable` (or set an env opt-out). It is a zero→one-event change for that specific user: under the old prompt the very first interactive `init` could be declined before anything was sent. This is the one real behavioural cost of dropping the prompt, and it is exactly the trade made by all the cited prior art (Next.js, .NET, Homebrew, Astro, Nuxt all send/collect the first run after a notice rather than gating it behind a prompt). It is accepted because the disclosure still precedes the send, the opt-out is one command away and permanent, and the prompt never reached the non-interactive and agent-driven population this flip exists to measure.
- **The notice is best-effort, not guaranteed-delivered.** If stderr is redirected or the write fails, the disclosure can be missed on a given run; the docs page is the durable reference. Accepted: blocking the command on a guaranteed-delivered notice would violate the isolation contract.

### Non-goals

- **No re-prompting of users who already chose.** A stored `enableTelemetry` (either value) is respected verbatim; the flip only reinterprets *absence*.
- **No telemetry in CI, ever.** CI remains hard-disabled and never sees the first-run notice.
- **No new identifier or new collected field.** The flip is purely about the default and its disclosure.

## Alternatives rejected

- **Rename `enableTelemetry` → `disableTelemetry`.** Inverting the field to make the opt-out polarity explicit on disk was rejected: a v0.11.0 user's stored `{ "enableTelemetry": false }` would either be ignored (silently **re-enabling** a user who deliberately opted out — the single worst outcome of this whole change) or would force a permanent legacy-field read path. Keeping the field name and only reinterpreting `undefined` honours every existing opt-out with no migration and no legacy compatibility surface.
- **First-run notice keyed purely on `installationId === undefined`, with no consideration of the stored opt-out / env state.** Rejected: a stored-`false` user and a `DO_NOT_TRACK` user both have *no* `installationId` (an opt-out never mints one), so a notice keyed naively on a missing id would falsely fire a "telemetry is on" disclosure at users who have explicitly turned it off. The notice is therefore reached only on the gating-**enabled** branch, after the env and stored-`false` checks have already excluded opted-out users.
- **Synchronous-flush notice or a guaranteed-delivered banner.** Rejected for the same reason ADR 217 rejects synchronous sends: anything on the command's hot path that can block or stain exit violates the isolation contract. The notice is a fire-and-forget stderr write wrapped best-effort.
- **Leave telemetry opt-in and add more prompts (e.g. prompt on first non-`init` command).** Rejected: more interactive prompts do nothing for the non-interactive and agent-driven population, which is exactly the gap, and they add friction to every entry point rather than relying on a single non-blocking notice.
- **Keep the interactive `init` consent prompt alongside the opt-out default.** An earlier draft retained the prompt and suppressed the first-run notice on interactive `init`. Rejected once the prior art (Next.js, .NET, Homebrew, Astro, Nuxt) was followed to its conclusion: none of those tools pair an opt-out default with an interactive prompt — they all use a first-run notice plus a `telemetry disable` command. Keeping the prompt meant two disclosure surfaces, a preAction suppression branch that had to stay in lockstep with the prompt's own gate, and a prompt that fired only for the interactive-human slice that was already the least under-counted. Dropping it is a net simplification and matches the cited prior art exactly; the cost is the zero→one-event trade recorded under *Trade-offs*.
