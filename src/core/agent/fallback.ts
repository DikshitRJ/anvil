// Failure classification and the Model Relay (retry with backoff, then switch to the next configured model).
export type FailureKind = 'transient' | 'model-fatal' | 'harness-down' | 'cancelled' | 'unknown';

const NET_CODES = ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET'];
const NET_MSG = /fetch failed|ECONNREFUSED|ENOTFOUND|network|socket/i;
const CANCEL_MSG = /client[- ]cancel|cancelled by (the )?(client|user)|aborted by (the )?user/i;
const FATAL =
  /\b40[134]\b|unauthori[sz]ed|invalid[^.]*(api[ _-]?key|key|token)|incorrect api key|authentication|permission denied|forbidden|not[ _]found|does not exist|unknown model|no such model|model[^.]*not (found|available|supported)|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|getaddrinfo|connection refused|unreachable|certificate|invalid url/i;
const TRANSIENT =
  /\b429\b|rate.?limit|overloaded|capacity|timeout|timed out|ETIMEDOUT|ECONNRESET|socket hang up|\b5\d\d\b|bad gateway|service unavailable|internal server error|temporar/i;

export function classifyFailure(f: {
  message?: string;
  statusCode?: number;
  code?: string;
  phase: 'connect' | 'turn' | 'stall';
}): FailureKind {
  const msg = f.message ?? '';
  if (f.phase === 'stall') return 'transient';
  if (CANCEL_MSG.test(msg)) return 'cancelled';
  if (f.phase === 'connect') return classifyConnect(f.statusCode, f.code, msg);
  if (FATAL.test(msg)) return 'model-fatal';
  if (TRANSIENT.test(msg)) return 'transient';
  return 'unknown';
}

function classifyConnect(statusCode: number | undefined, code: string | undefined, msg: string): FailureKind {
  if ((code && NET_CODES.includes(code)) || NET_MSG.test(msg) || statusCode === undefined) return 'harness-down';
  return statusCode >= 500 || statusCode === 429 ? 'transient' : 'unknown';
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
  private index = 0;
  private attempts = 0;
  private readonly backoff: number[];

  constructor(protected policy: RelayPolicy) {
    if (policy.models.length === 0) {
      throw new Error('No models configured — set "anvil.models" to at least one TrueForge model (provider/model).');
    }
    this.backoff = policy.backoffMs.length > 0 ? policy.backoffMs : [500, 1500, 4000];
  }

  current(): string {
    return this.policy.models[this.index] as string;
  }

  onFailure(kind: FailureKind, message: string): RelayStep {
    if (kind === 'cancelled') return { action: 'give-up', reason: 'cancelled' };
    if (kind === 'harness-down') return { action: 'give-up', reason: 'TrueForge is not reachable' };
    if ((kind === 'transient' || kind === 'unknown') && this.attempts < this.policy.retriesPerModel) {
      const delayMs = this.backoff[this.attempts] ?? (this.backoff[this.backoff.length - 1] as number);
      this.attempts++;
      return { action: 'retry', model: this.current(), delayMs };
    }
    const next = this.policy.models[this.index + 1];
    if (next !== undefined) {
      const from = this.current();
      this.index++;
      this.attempts = 0;
      return { action: 'switch', from, model: next };
    }
    return { action: 'give-up', reason: `All configured models failed. Last error: ${message}` };
  }

  reset(): void {
    this.index = 0;
    this.attempts = 0;
  }
}
