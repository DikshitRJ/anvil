export type FailureKind = 'transient' | 'model-fatal' | 'harness-down' | 'cancelled' | 'unknown';

export function classifyFailure(_f: {
  message?: string;
  statusCode?: number;
  code?: string;
  phase: 'connect' | 'turn' | 'stall';
}): FailureKind {
  throw new Error('not implemented');
}

export interface RelayPolicy {
  models: string[];
  retriesPerModel: number;
  backoffMs: number[];
}

export type RelayStep =
  | { action: 'retry'; model: string; delayMs: number }
  | { action: 'switch'; model: string; from: string }
  | { action: 'give-up'; reason: string };

export class ModelRelay {
  constructor(protected policy: RelayPolicy) {}

  current(): string {
    throw new Error('not implemented');
  }
  onFailure(_kind: FailureKind, _message: string): RelayStep {
    throw new Error('not implemented');
  }
  reset(): void {
    throw new Error('not implemented');
  }
}
