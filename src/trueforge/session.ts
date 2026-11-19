import type { TrueForge } from '@truefoundry/trueforge-sdk';
import type { ResolvedToolCall } from '../core/agent/toolCalls';
import type { TurnView } from '../core/agent/events';
import type { ModelRelay } from '../core/agent/fallback';
import type { AgentDefinition } from './spec';

export interface ApprovalRequest {
  call: ResolvedToolCall;
}

export type ApprovalDecision = { allow: true } | { allow: false; reason: string };

export interface RunHooks {
  onEvent?(event: unknown, view: TurnView): void;
  onApproval(req: ApprovalRequest): Promise<ApprovalDecision>;
  onQuestion?(question: string, options: string[]): Promise<string>;
  onModelSwitch?(from: string, to: string, reason: string): void;
  onRetry?(model: string, attempt: number, delayMs: number, reason: string): void;
  // host rolls back the failed attempt's writes
  beforeRetry?(): Promise<void>;
}

export interface RunResult {
  status: 'done' | 'cancelled' | 'error';
  output?: string;
  model: string;
  error?: string;
  sessionId?: string;
  metrics?: Record<string, number>;
}

export class AnvilSession {
  constructor(
    protected opts: {
      client: TrueForge;
      agent: AgentDefinition;
      relay: ModelRelay;
      stallTimeoutMs: number;
      title?: string;
    },
  ) {}

  get sessionId(): string | undefined {
    return undefined;
  }

  run(_input: string, _hooks: RunHooks): Promise<RunResult> {
    throw new Error('not implemented');
  }
  cancel(): Promise<void> {
    throw new Error('not implemented');
  }
  dispose(): void {
    throw new Error('not implemented');
  }
}
