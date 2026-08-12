export interface StatusRef {
  readonly name: string;
  readonly hash: string;
  readonly active: boolean;
}

export interface StatusDiagnostic {
  readonly code: string;
  readonly severity: 'warn' | 'info';
  readonly message: string;
  readonly hints: readonly string[];
}
