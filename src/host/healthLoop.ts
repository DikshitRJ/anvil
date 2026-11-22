// Polls TrueForge health every 15 s; fires `onChange` each tick and `onUp` on every down/unknown -> ok transition.
import * as vscode from 'vscode';

export class HealthLoop implements vscode.Disposable {
  private timer: NodeJS.Timeout | undefined;
  private state: 'ok' | 'down' | 'unknown' = 'unknown';
  private busy = false;
  private disposed = false;

  constructor(
    private readonly check: () => Promise<boolean>,
    private readonly onChange: (state: 'ok' | 'down') => void,
    private readonly onUp: () => void,
    private readonly intervalMs = 15000,
  ) {}

  get current(): 'ok' | 'down' | 'unknown' {
    return this.state;
  }

  start(): void {
    if (this.disposed || this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  /** Check now, e.g. after the TrueForge URL setting changed. */
  async tick(): Promise<void> {
    if (this.disposed || this.busy) return;
    this.busy = true;
    try {
      const ok = await this.check().catch(() => false);
      if (this.disposed) return;
      const next = ok ? 'ok' : 'down';
      const wasUp = this.state === 'ok';
      this.state = next;
      this.onChange(next);
      if (ok && !wasUp) this.onUp();
    } finally {
      this.busy = false;
    }
  }

  dispose(): void {
    this.disposed = true;
    clearInterval(this.timer);
  }
}
