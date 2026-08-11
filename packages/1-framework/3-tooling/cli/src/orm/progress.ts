import { ifDefined } from '@internal/utils/defined';
import type { EngineEvent } from '@prisma/cli-engine';
import type { ControlProgressEvent, OnControlProgress } from '../control-api/types';

type StepOutcome = Extract<EngineEvent, { kind: 'step-finished' }>['outcome'];

const OUTCOMES: Record<Extract<ControlProgressEvent, { kind: 'spanEnd' }>['outcome'], StepOutcome> =
  {
    ok: 'ok',
    skipped: 'skipped',
    error: 'failed',
  };

/**
 * The control API's spans as engine events. A span's label is remembered when
 * it starts so the finishing event names the step with the same words.
 */
export function controlProgressReporter(report: (event: EngineEvent) => void): OnControlProgress {
  const labels = new Map<string, string>();
  return (event) => {
    if (event.kind === 'spanStart') {
      labels.set(event.spanId, event.label);
      report({
        kind: 'step-started',
        step: event.label,
        id: event.spanId,
        ...ifDefined('parentId', event.parentSpanId),
      });
      return;
    }
    report({
      kind: 'step-finished',
      step: labels.get(event.spanId) ?? event.spanId,
      id: event.spanId,
      outcome: OUTCOMES[event.outcome],
    });
  };
}
