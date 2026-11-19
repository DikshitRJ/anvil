import type { ResolvedToolCall } from './toolCalls';

export type ToolStatus = 'streaming' | 'awaiting-approval' | 'running' | 'done' | 'denied' | 'error';

export interface ToolCallView {
  id: string;
  threadId: string;
  tool: string;
  server?: string;
  input: Record<string, unknown>;
  status: ToolStatus;
  result?: string;
}

export interface MessageView {
  id: string;
  threadId: string;
  content: string;
}

export interface ThreadView {
  id: string;
  title: string;
  status: 'running' | 'done' | 'error';
}

export interface TurnView {
  turnId?: string;
  status: 'running' | 'paused' | 'done' | 'cancelled' | 'error';
  messages: MessageView[];
  toolCalls: ToolCallView[];
  threads: ThreadView[];
  pending: ResolvedToolCall[];
  error?: string;
  output?: string;
  lastEventId?: string;
  metrics?: Record<string, number>;
}

export class TurnReducer {
  apply(_event: unknown): void {
    throw new Error('not implemented');
  }
  view(): TurnView {
    throw new Error('not implemented');
  }
  toolCall(_id: string): ResolvedToolCall | undefined {
    throw new Error('not implemented');
  }
  reset(): void {
    throw new Error('not implemented');
  }
}
