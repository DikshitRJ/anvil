import type { SearchHit, SymbolInfo } from './types';

export class CodeIndex {
  constructor(protected root: string) {}

  build(_onProgress?: (done: number, total: number) => void): Promise<void> {
    throw new Error('not implemented');
  }
  updateFile(_rel: string, _content: string): void {
    throw new Error('not implemented');
  }
  removeFile(_rel: string): void {
    throw new Error('not implemented');
  }
  files(): string[] {
    throw new Error('not implemented');
  }
  getContent(_rel: string): string | undefined {
    throw new Error('not implemented');
  }
  symbolsOf(_rel: string): SymbolInfo[] {
    throw new Error('not implemented');
  }
  search(_query: string, _k?: number): SearchHit[] {
    throw new Error('not implemented');
  }
  findSymbol(_name: string, _kind?: string): SymbolInfo[] {
    throw new Error('not implemented');
  }
  grep(
    _pattern: string,
    _opts?: { glob?: string; limit?: number; ignoreCase?: boolean },
  ): { path: string; line: number; text: string }[] {
    throw new Error('not implemented');
  }
  // 1-hop import graph (both directions)
  neighbors(_rel: string): string[] {
    throw new Error('not implemented');
  }
  repoMap(_opts?: { maxTokens?: number; focus?: string[] }): string {
    throw new Error('not implemented');
  }
}
