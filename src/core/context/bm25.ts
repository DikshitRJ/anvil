export class Bm25Index {
  add(_id: string, _tokens: string[]): void {
    throw new Error('not implemented');
  }
  remove(_id: string): void {
    throw new Error('not implemented');
  }
  search(_q: string[], _k: number): { id: string; score: number; matched: string[] }[] {
    throw new Error('not implemented');
  }
  size(): number {
    throw new Error('not implemented');
  }
}
