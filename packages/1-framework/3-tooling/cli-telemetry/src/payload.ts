import { type } from 'arktype';

/**
 * Wire-shape payload the parent IPC-sends to the forked child sender.
 * Mirrors only the fields the parent has naturally in hand at command
 * start: installation id, sanitised command + flags, CLI version, and
 * the project root the child uses to discover everything else. The
 * child probes its own process (runtime/os/arch, package manager, ts
 * version, agent) and reads the user's `prisma-next.config.*` via
 * c12 to derive `databaseTarget` and `extensions`.
 *
 * Loading c12 on the parent side would put a `loadConfig()` await on
 * the command's hot path between gate resolution and `fork()`,
 * opening a race against any CLI command that throws synchronously
 * before that await resolves (the parent exits before forking the
 * sender, and the telemetry event is lost). Moving the load into the
 * detached child eliminates that race; the trade is that the child
 * now evaluates user TS config code, so it's gated behind the same
 * privacy checks the parent already resolved before forking.
 *
 * `databaseTarget` is an optional parent-side override for the
 * c12-derived value: the first-`init` invocation supplies the
 * prompt-chosen target via this field because the config file does
 * not yet exist on disk at that moment. Every other invocation
 * leaves it unset (`undefined`) and the child's c12 load determines
 * the value — there is no third state, so the field's type is
 * `string | undefined`, not `string | null | undefined`.
 *
 * Both sides version-couple on this shape because the IPC carrier is
 * structured-cloned by Node and there's no on-wire compat to maintain.
 */
export interface ParentToSenderPayload {
  readonly installationId: string;
  readonly version: string;
  readonly command: string;
  readonly flags: readonly string[];
  /**
   * Absolute path of the user's project. The child reads
   * `<projectRoot>/package.json` for `tsVersion` and loads
   * `<projectRoot>/prisma-next.config.*` via c12 for `databaseTarget`
   * + `extensions`.
   */
  readonly projectRoot: string;
  /** Resolved endpoint URL (already includes the `/events` path). */
  readonly endpoint: string;
  /**
   * Optional parent-side override for the c12-derived database target.
   * Set by `fireTelemetryAfterInitConsent` (the first-`init` path,
   * where the config file is about to be written but doesn't exist
   * yet); left undefined by `fireTelemetryFromPreAction` (steady
   * state, child resolves the value via c12). The wire-format
   * `TelemetryEvent.databaseTarget: string | null` keeps `null` as
   * the on-the-wire "no target known" marker, but the IPC override
   * channel only needs two states so it's `string | undefined`.
   */
  readonly databaseTarget?: string;
}

/**
 * Runtime validator for {@link ParentToSenderPayload}. The child sender
 * uses this to gate `postEvent` so a payload missing a required field
 * cannot silently produce a degraded telemetry event downstream.
 *
 * Mirrors the backend's own arktype schema in spirit: required scalars
 * must be non-empty strings; the optional `databaseTarget` override is
 * `string` when present (no `null` — see the type's doc-block); the
 * string array is validated element-by-element. Size caps are enforced
 * by the backend, not here — IPC is structured-cloned and the
 * parent/child agree on the schema by version-coupling.
 */
const requiredString = type.string.moreThanLength(0);
const stringArray = type.string.array();

export const parentToSenderPayloadSchema = type({
  installationId: requiredString,
  version: requiredString,
  command: requiredString,
  flags: stringArray,
  projectRoot: requiredString,
  endpoint: requiredString,
  'databaseTarget?': type.string,
});

export function isParentToSenderPayload(value: unknown): value is ParentToSenderPayload {
  return !(parentToSenderPayloadSchema(value) instanceof type.errors);
}

/**
 * The full event the child POSTs to the backend. Shape matches the
 * backend's arktype schema (`apps/telemetry-backend/src/schema.ts`).
 */
export interface TelemetryEvent {
  readonly installationId: string;
  readonly version: string;
  readonly command: string;
  readonly flags: readonly string[];
  readonly runtimeName: string;
  readonly runtimeVersion: string;
  readonly os: string;
  readonly arch: string;
  readonly packageManager: string | null;
  readonly databaseTarget: string | null;
  readonly tsVersion: string | null;
  readonly agent: string | null;
  readonly extensions: readonly string[];
}
