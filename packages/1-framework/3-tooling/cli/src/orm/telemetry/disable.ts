import { userConfigPath, writeUserConfig } from '@internal/cli-telemetry';
import { defineCommand } from '@prisma/cli-engine';
import { ok } from '@prisma/cli-engine/protocol';
import { consentPresentations } from './consent';

export const telemetryDisableCommand = defineCommand({
  help: {
    summary: 'Disable anonymous CLI telemetry',
    description:
      'Stores "enableTelemetry": false in your user-level config. No installation\n' +
      'ID is minted and no event is sent.',
    examples: ['telemetry disable'],
  },
  handler: async (_args, ctx) => {
    writeUserConfig({ enableTelemetry: false });
    const configPath = userConfigPath();
    const data = { enableTelemetry: false, configPath };
    return ok(
      ctx.present(
        { data },
        consentPresentations(`Telemetry disabled. Preference stored in ${configPath}.`, data),
      ),
    );
  },
});
