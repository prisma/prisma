export type ContractValidationPhase = 'structural' | 'domain' | 'storage';

export class ContractValidationError extends Error {
  readonly code = 'CONTRACT.VALIDATION_FAILED';
  readonly phase: ContractValidationPhase;

  constructor(message: string, phase: ContractValidationPhase) {
    super(message);
    this.name = 'ContractValidationError';
    this.phase = phase;
  }
}
