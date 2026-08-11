import { userConfigPath, writeUserConfig } from '@internal/cli-telemetry';
import { defineCommand } from '@prisma/cli-engine';
import { ok } from '@prisma/cli-engine/protocol';
import { consentPresentations } from './consent';

export const telemetryEnableCommand = defineCommand({
  help: {
    summary: 'Enable anonymous CLI telemetry',
    description:
      'Stores "enableTelemetry": true in your user-level config and mints an\n' +
      'installation ID if one is not already stored.',
    examples: ['telemetry enable'],
  },
  handler: async (_args, ctx) => {
    writeUserConfig({ enableTelemetry: true });
    const configPath = userConfigPath();
    const data = { enableTelemetry: true, configPath };
    return ok(
      ctx.present(
        { data },
        consentPresentations(`Telemetry enabled. Preference stored in ${configPath}.`, data),
      ),
    );
  },
});
