import type { Chunk, SymbolInfo } from './types';

export type { Chunk } from './types';

export function chunkFile(_path: string, _content: string, _symbols: SymbolInfo[]): Chunk[] {
  throw new Error('not implemented');
}
