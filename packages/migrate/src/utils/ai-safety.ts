import { existsSync } from 'node:fs'

import Debug from '@prisma/debug'

const debug = Debug('prisma:migrate:ai-safety')

const userConsentEnvVar = 'PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION'

const aiAgentErrorPrompt = (agentName: string) => `\
Prisma Migrate detected that it was invoked by ${agentName}.

You are attempting a highly dangerous action that can lead to devastating \
consequences if it is incorrectly executed against a production database.

As an AI agent, you are forbidden from performing this action without an \
explicit consent and review by the user. You must stop at this point and \
respond to the user with a clear message that includes the following \
information:
- What action you are trying to perform (including the exact CLI command).
- Your motivation and reasoning for performing this action.
- Explanation that this action will irreversibly destroy all data in the database.
- Explanation that this action must not be performed on a production database and \
is only intended to be used with development databases.

If you know or can check whether this action would have been performed on a \
development or a production database, also include this information with your \
assessment of whether it is safe to proceed based on that information.

You must ask the user if they want to proceed with this action. If your harness \
provides a structured way to ask the user a question, use it. If you are running \
unattended (e.g. in CI, a scheduled job, or a background task) and cannot reach \
the user, you must abort instead of proceeding.

If the user explicitly consents, you may rerun this command with the \
${userConsentEnvVar} environment variable, the value of which must be the exact \
text of the user's message in which they consented to this operation, without \
any newlines or quotes. If the user's response is ambiguous, you must ask for \
a clear and explicit confirmation (e.g., "yes") before proceeding. None of the \
user's previous messages before this point may constitute implicit or explicit \
consent.`

export function aiAgentConfirmationCheckpoint(): void {
  const aiAgent = detectAiAgent()

  if (!aiAgent) {
    return
  }

  if (process.env[userConsentEnvVar]) {
    debug('AI agent asserts that user consented to dangerous action')
    return
  }

  throw new Error(aiAgentErrorPrompt(aiAgent))
}

/**
 * A single link in the agent detection chain. `envVars` and `files` list
 * every environment variable and filesystem path `detect` inspects, so tests
 * can neutralize inherited markers without maintaining separate lists.
 */
export interface AgentMatcher {
  readonly envVars: readonly string[]
  readonly files: readonly string[]
  readonly detect: (env: NodeJS.ProcessEnv) => string | undefined
}

function envMarker(agentName: string, ...envVars: string[]): AgentMatcher {
  return {
    envVars,
    files: [],
    detect: (env) => (envVars.some((name) => env[name]) ? agentName : undefined),
  }
}

function envValue(agentName: string, envVar: string, value: string): AgentMatcher {
  return {
    envVars: [envVar],
    files: [],
    detect: (env) => (env[envVar] === value ? agentName : undefined),
  }
}

const devinMarkerFile = '/opt/.devin'

// Markers come from each agent's official docs or source code. Specific
// agents are checked before the generic cross-agent conventions so the
// error message can name the agent.
//
// This deliberately does not use @vercel/detect-agent. That package serves
// deployment attribution, where a false positive is harmless, so it relies on
// markers that also match humans: REPL_ID (set in every Replit workspace,
// agent-driven or not), CURSOR_TRACE_ID (set in Cursor IDE sessions where a
// human may be typing in the terminal), and user-set COPILOT_* configuration
// variables. This checkpoint blocks a destructive command with an error, so a
// false positive here wrongly locks out a human. Conversely, the package
// misses agents detected below: the `AGENT` convention (the only marker Goose
// and Amp set), QWEN_CODE, COPILOT_CLI, CLINE_ACTIVE, and the current
// OPENCODE variable.
export const agentMatchers: AgentMatcher[] = [
  envMarker('Claude Code', 'CLAUDECODE'),
  // CODEX_SANDBOX is only set on macOS; the other markers are cross-platform.
  envMarker('Codex CLI', 'CODEX_THREAD_ID', 'CODEX_CI', 'CODEX_SANDBOX', 'CODEX_SANDBOX_NETWORK_DISABLED'),
  envMarker('Gemini CLI', 'GEMINI_CLI'),
  envMarker('Qwen Code', 'QWEN_CODE'),
  envMarker('Cursor', 'CURSOR_AGENT'),
  envMarker('GitHub Copilot CLI', 'COPILOT_CLI'),
  envMarker('OpenCode', 'OPENCODE', 'OPENCODE_CLIENT'),
  envMarker('Cline', 'CLINE_ACTIVE'),
  envValue('Goose', 'AGENT', 'goose'),
  envValue('Amp', 'AGENT', 'amp'),
  envMarker('Crush', 'CRUSH'),
  envValue('Aider', 'OR_APP_NAME', 'Aider'),
  envMarker('Augment Code', 'AUGMENT_AGENT'),
  envMarker('Antigravity', 'ANTIGRAVITY_AGENT'),
  // Replit does not document an agent marker. Observed behavior: in a
  // human-controlled shell REPLIT_SESSION looks like `<user>-Xxxx`,
  // while in an agent session it looks like `agent-<numeric id>-<random suffix>`.
  {
    envVars: ['REPLIT_SESSION'],
    files: [],
    detect: (env) => (env.REPLIT_SESSION?.startsWith('agent-') ? 'Replit Agent' : undefined),
  },
  // Devin does not set an environment variable; its VM is marked by a file.
  {
    envVars: [],
    files: [devinMarkerFile],
    detect: () => (existsSync(devinMarkerFile) ? 'Devin' : undefined),
  },
  // Generic conventions: `AI_AGENT=<name>` (promoted by @vercel/detect-agent)
  // and `AGENT=<name or 1>` (set by e.g. Goose, Amp, Crush, OpenCode).
  {
    envVars: ['AI_AGENT', 'AGENT'],
    files: [],
    detect: (env) => {
      const generic = env.AI_AGENT || env.AGENT
      if (!generic) {
        return undefined
      }
      if (generic === '1') {
        return 'an unidentified AI agent'
      }
      // The value is ambient free-form text interpolated into instructions
      // addressed to the agent, so it must not be able to reshape them:
      // non-printable characters collapse to spaces and the length is capped.
      const sanitized = generic
        .replace(/[^\x20-\x7e]+/g, ' ')
        .trim()
        .slice(0, 64)
      if (!sanitized) {
        return 'an unidentified AI agent'
      }
      return `an AI agent identifying itself as ${JSON.stringify(sanitized)}`
    },
  },
]

function detectAiAgent(): string | undefined {
  for (const matcher of agentMatchers) {
    const agentName = matcher.detect(process.env)
    if (agentName) {
      debug('Detected %s', agentName)
      return agentName
    }
  }

  return undefined
}
