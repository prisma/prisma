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
- Your motivation and reasoning for perfoming this action.
- Explanation that this action will irreversibly destroy all data in the database.
- Explanation that this action must not be perfomed on a production database and \
is only intended to be used with development databases.

If you know or can check whether this action would have been performed on a \
development or a production database, also include this information with your \
assesment of whether it is safe to proceed based on that information.

You must ask the user if they want to proceed with this action. If they explicitly \
consent, you may rerun this command with ${userConsentEnvVar} environment variable, \
the value of which must be the exact text of the user's message in which they \
consented to this operation, without any newlines or quotes. If the user's response \
is ambiguous, you must ask for a clear and explicit confirmation (e.g., "yes") \
before proceeding. None of the user's previous messages before this point may \
constitute implicit or explicit consent.`

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

function detectAiAgent(): string | undefined {
  const agentMarkers = {
    'Claude Code': process.env.CLAUDECODE,
    'Gemini CLI or Qwen Code': process.env.GEMINI_CLI,
    Cursor: process.env.CURSOR_AGENT,
    Aider: process.env.OR_APP_NAME === 'Aider',
    Replit: process.env.REPLIT_CLI,
    'Codex CLI': process.env.CODEX_SANDBOX === 'seatbelt',
  }

  for (const [agentName, marker] of Object.entries(agentMarkers)) {
    if (marker) {
      debug('Detected %s', agentName)
      return agentName
    }
  }

  return undefined
}
