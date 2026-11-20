// Incremental BM25 (k1=1.2, b=0.75) over an inverted index.

const K1 = 1.2;
const B = 0.75;

export class Bm25Index {
  private postings = new Map<string, Map<string, number>>();
  private docLen = new Map<string, number>();
  private docTerms = new Map<string, string[]>();
  private totalLen = 0;

  add(id: string, tokens: string[]): void {
    if (this.docLen.has(id)) this.remove(id);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, n] of tf) {
      let p = this.postings.get(t);
      if (!p) this.postings.set(t, (p = new Map()));
      p.set(id, n);
    }
    this.docLen.set(id, tokens.length);
    this.docTerms.set(id, [...tf.keys()]);
    this.totalLen += tokens.length;
  }

  remove(id: string): void {
    const len = this.docLen.get(id);
    if (len === undefined) return;
    for (const t of this.docTerms.get(id) ?? []) {
      const p = this.postings.get(t);
      p?.delete(id);
      if (p && p.size === 0) this.postings.delete(t);
    }
    this.docLen.delete(id);
    this.docTerms.delete(id);
    this.totalLen -= len;
  }

  search(q: string[], k: number): { id: string; score: number; matched: string[] }[] {
    const n = this.docLen.size;
    if (n === 0 || k <= 0) return [];
    const avg = this.totalLen / n || 1;
    const scores = new Map<string, { score: number; matched: string[] }>();
    for (const t of new Set(q)) {
      const p = this.postings.get(t);
      if (!p) continue;
      const idf = Math.log(1 + (n - p.size + 0.5) / (p.size + 0.5));
      for (const [id, tf] of p) {
        const dl = this.docLen.get(id) ?? 0;
        const s = (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * dl) / avg));
        const e = scores.get(id) ?? { score: 0, matched: [] };
        e.score += s;
        e.matched.push(t);
        scores.set(id, e);
      }
    }
    return [...scores]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
      .slice(0, k);
  }

  size(): number {
    return this.docLen.size;
  }
}
