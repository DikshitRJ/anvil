// vscode-free review state: per-hunk decisions, result/feedback text, and hunk <-> preview-line mapping.
import { applyHunks, computeHunks, previewContent, summarizeHunk } from '../core/diff/hunks';
import type { Hunk, HunkDecision } from '../core/diff/hunks';

export interface ReviewOutcome {
  content: string | null;
  accepted: number;
  total: number;
  feedback: string;
}

export interface HunkAnchor {
  hunkId: number;
  line: number; // 0-based first line of the hunk in the preview text
  span: number; // preview lines the hunk occupies (0 for a deletion or a rejected insertion)
}

const MAX_FEEDBACK_LINES = 40;

function capLines(text: string): string {
  const lines = text.split('\n');
  if (lines.length <= MAX_FEEDBACK_LINES) return text;
  return [...lines.slice(0, MAX_FEEDBACK_LINES), `… (${lines.length - MAX_FEEDBACK_LINES} more lines)`].join('\n');
}

export class ReviewModel {
  readonly hunks: Hunk[];
  private readonly decisions = new Map<number, HunkDecision>();

  constructor(
    readonly original: string,
    proposed: string,
  ) {
    this.hunks = computeHunks(original, proposed);
    for (const h of this.hunks) this.decisions.set(h.id, 'pending');
  }

  get total(): number {
    return this.hunks.length;
  }
  decisionOf(id: number): HunkDecision {
    return this.decisions.get(id) ?? 'pending';
  }
  get decidedCount(): number {
    return this.hunks.filter((h) => this.decisionOf(h.id) !== 'pending').length;
  }
  get acceptedCount(): number {
    return this.hunks.filter((h) => this.decisionOf(h.id) === 'accepted').length;
  }
  get allDecided(): boolean {
    return this.decidedCount === this.total;
  }

  decide(id: number, d: HunkDecision): boolean {
    if (!this.decisions.has(id)) return false;
    this.decisions.set(id, d);
    return true;
  }
  decideAll(d: HunkDecision): void {
    for (const h of this.hunks) this.decisions.set(h.id, d);
  }

  preview(): string {
    return previewContent(this.original, this.hunks, this.decisions);
  }

  outcome(): ReviewOutcome {
    const accepted = this.acceptedCount;
    const set = new Set(this.hunks.filter((h) => this.decisionOf(h.id) === 'accepted').map((h) => h.id));
    const content = accepted === 0 ? null : applyHunks(this.original, this.hunks, set);
    return { content, accepted, total: this.total, feedback: this.feedback() };
  }

  feedback(): string {
    const n = this.total;
    const a = this.acceptedCount;
    if (n === 0) return 'No changes were proposed.';
    if (a === n) return `Accepted all ${n} hunk(s).`;
    const rejected = this.hunks
      .filter((h) => this.decisionOf(h.id) === 'rejected')
      .map((h) => summarizeHunk(h, 8))
      .join('\n');
    const head =
      a === 0 ? `The user rejected all ${n} hunk(s):\n` : `Accepted ${a} of ${n} hunks. The user rejected:\n`;
    return capLines(head + rejected);
  }

  // where each hunk starts in preview(): rejected hunks revert to their original line count
  anchors(): HunkAnchor[] {
    let delta = 0;
    return [...this.hunks]
      .sort((x, y) => x.origStart - y.origStart)
      .map((h) => {
        const shown = this.decisionOf(h.id) === 'rejected' ? h.origLines.length : h.newLines.length;
        const anchor = { hunkId: h.id, line: h.origStart + delta, span: shown };
        delta += shown - h.origLines.length;
        return anchor;
      })
      .sort((x, y) => x.hunkId - y.hunkId);
  }

  // hunk containing the line, else the nearest one
  hunkAtLine(line: number): number | undefined {
    let best: { id: number; dist: number } | undefined;
    for (const a of this.anchors()) {
      const end = a.line + Math.max(a.span, 1) - 1;
      const dist = line < a.line ? a.line - line : line > end ? line - end : 0;
      if (!best || dist < best.dist) best = { id: a.hunkId, dist };
    }
    return best?.id;
  }
}

// workspace-relative POSIX path when `file` is inside `root`, else undefined
export function relativeInside(root: string, file: string): string | undefined {
  const norm = (p: string): string => p.replace(/\\/g, '/').replace(/\/+$/, '');
  const r = norm(root);
  const f = norm(file);
  if (!f.startsWith(r + '/') || f.length === r.length + 1) return undefined;
  return f.slice(r.length + 1);
}
