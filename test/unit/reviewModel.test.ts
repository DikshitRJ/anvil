import { describe, expect, it } from 'vitest';
import { ReviewModel, relativeInside } from '../../src/host/reviewModel';

const orig = 'a\nb\nc\nd\ne\nf\ng\n';
const prop = 'a\nB1\nB2\nc\nd\ne\ng\n'; // hunk0: b -> B1,B2 (+1 line); hunk1: delete f

describe('ReviewModel', () => {
  it('applies a change with zero hunks instead of reporting a rejection', () => {
    expect(new ReviewModel('', '').outcome().content).toBeNull();
    const o = 'a\r\nb\r\nc\n';
    const p = 'a\r\nb\r\nc\r\n';
    const out = new ReviewModel(o, p).outcome();
    expect(out.feedback).not.toContain('rejected');
    expect(out.content === p || out.total > 0).toBe(true);
  });
  it('reports a newline-only change as a reviewable hunk', () => {
    const m = new ReviewModel('a\nb', 'a\nb\n');
    expect(m.total).toBe(1);
    m.decideAll('accepted');
    expect(m.outcome().content).toBe('a\nb\n');
  });
  it('has no hunks for identical text', () => {
    const m = new ReviewModel('x\n', 'x\n');
    expect(m.outcome()).toEqual({ content: null, accepted: 0, total: 0, feedback: 'No visible changes.' });
  });

  it('accept all returns proposed content', () => {
    const m = new ReviewModel(orig, prop);
    expect(m.total).toBe(2);
    m.decideAll('accepted');
    const o = m.outcome();
    expect(o.content).toBe(prop);
    expect(o.feedback).toBe('Accepted all 2 hunk(s).');
    expect(m.allDecided).toBe(true);
  });

  it('reject all returns null content and summaries', () => {
    const m = new ReviewModel(orig, prop);
    m.decideAll('rejected');
    const o = m.outcome();
    expect(o.content).toBeNull();
    expect(o.feedback).toMatch(/^The user rejected all 2 hunk\(s\):\n@@/);
  });

  it('partial acceptance', () => {
    const m = new ReviewModel(orig, prop);
    m.decide(0, 'accepted');
    m.decide(1, 'rejected');
    const o = m.outcome();
    expect(o.content).toBe('a\nB1\nB2\nc\nd\ne\nf\ng\n');
    expect(o.feedback).toMatch(/^Accepted 1 of 2 hunks\. The user rejected:\n/);
    expect(o.feedback).toContain('-f');
  });

  it('caps feedback length', () => {
    const big = Array.from({ length: 100 }, (_, i) => `l${i}`).join('\n') + '\n';
    const changed = Array.from({ length: 100 }, (_, i) => `x${i}`).join('\n') + '\n';
    const m = new ReviewModel(big, changed);
    m.decideAll('rejected');
    expect(m.feedback().split('\n').length).toBeLessThanOrEqual(42);
  });

  it('ignores unknown hunk ids', () => {
    expect(new ReviewModel(orig, prop).decide(9, 'accepted')).toBe(false);
  });

  it('anchors account for rejected hunks', () => {
    const m = new ReviewModel(orig, prop);
    expect(m.anchors()).toEqual([
      { hunkId: 0, line: 1, span: 2 },
      { hunkId: 1, line: 6, span: 0 },
    ]);
    m.decide(0, 'rejected');
    expect(m.anchors()[1]).toEqual({ hunkId: 1, line: 5, span: 0 });
    expect(m.preview().split('\n')[5]).toBe('g');
  });

  it('maps lines to hunks', () => {
    const m = new ReviewModel(orig, prop);
    expect(m.hunkAtLine(2)).toBe(0);
    expect(m.hunkAtLine(6)).toBe(1);
    expect(m.hunkAtLine(0)).toBe(0);
    expect(m.hunkAtLine(4)).toBe(0);
    expect(m.hunkAtLine(5)).toBe(1);
  });
});

describe('relativeInside', () => {
  it('returns the relative path for files inside the root', () => {
    expect(relativeInside('/w/p', '/w/p/src/a.ts')).toBe('src/a.ts');
    expect(relativeInside('/w/p/', '/w/p/a.ts')).toBe('a.ts');
  });
  it('rejects files outside the root or sibling prefixes', () => {
    expect(relativeInside('/w/p', '/w/other/a.ts')).toBeUndefined();
    expect(relativeInside('/w/p', '/w/p2/a.ts')).toBeUndefined();
    expect(relativeInside('/w/p', '/w/p')).toBeUndefined();
  });
});

describe('review decision reversibility', () => {
  it('recomputes preview and accepted counts when a decision changes', () => {
    const model = new ReviewModel(orig, prop);
    model.decideAll('accepted');
    expect(model.acceptedCount).toBe(2);
    model.decide(0, 'rejected');
    expect(model.acceptedCount).toBe(1);
    expect(model.preview()).toBe('a\nb\nc\nd\ne\ng\n');
    model.decide(0, 'pending');
    expect(model.decidedCount).toBe(1);
    expect(model.allDecided).toBe(false);
    expect(model.preview()).toBe(prop);
    expect(model.outcome().content).toBe('a\nb\nc\nd\ne\ng\n');
  });
  it('resetting all decisions to pending does not accept any changes', () => {
    const model = new ReviewModel(orig, prop);
    model.decideAll('accepted');
    model.decideAll('pending');
    expect(model.outcome().content).toBeNull();
    expect(model.acceptedCount).toBe(0);
    expect(model.decidedCount).toBe(0);
    expect(model.preview()).toBe(prop);
  });
});
