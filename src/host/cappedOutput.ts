// Output accumulator that keeps the first 16 KB and last 48 KB of a stream (vscode-free, unit-tested).
const HEAD = 16 * 1024;
const TAIL = 48 * 1024;

export class CappedOutput {
  private head = '';
  private tail = '';
  private skipped = 0;

  push(chunk: string): void {
    if (this.head.length < HEAD) {
      const take = HEAD - this.head.length;
      this.head += chunk.slice(0, take);
      chunk = chunk.slice(take);
    }
    this.tail += chunk;
    if (this.tail.length > TAIL) {
      this.skipped += this.tail.length - TAIL;
      this.tail = this.tail.slice(-TAIL);
    }
  }

  toString(): string {
    return this.skipped
      ? `${this.head}\n... [${this.skipped} chars truncated] ...\n${this.tail}`
      : this.head + this.tail;
  }
}
