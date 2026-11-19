import type { CodeIndex } from './codeIndex';
import type { ContextPack, ContextSignals } from './types';

export type { ContextItem, ContextPack, ContextSignals } from './types';

// Math.ceil(chars / 4)
export function estimateTokens(_text: string): number {
  throw new Error('not implemented');
}

export function assembleContext(_index: CodeIndex, _s: ContextSignals, _budget: number): ContextPack {
  throw new Error('not implemented');
}

// <anvil_context …> block placed in the user message
export function renderContextPack(_p: ContextPack): string {
  throw new Error('not implemented');
}
