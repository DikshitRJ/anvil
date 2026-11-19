import { describe, expect, it } from 'vitest';
import { enqueue } from '../../src/panel/messageQueue';
import type { HostToWebview } from '../../src/panel/protocol';

const text = (id: string, content: string): HostToWebview => ({
  type: 'text',
  runId: 'r',
  messageId: id,
  threadId: 't',
  content,
});

describe('enqueue', () => {
  it('keeps only the latest text per messageId, in place', () => {
    let q: HostToWebview[] = [];
    q = enqueue(q, text('a', '1'));
    q = enqueue(q, text('b', 'x'));
    q = enqueue(q, text('a', '12'));
    expect(q).toEqual([text('a', '12'), text('b', 'x')]);
  });

  it('caps the queue, dropping oldest non-essential first', () => {
    const health: HostToWebview = { type: 'health', trueforge: 'ok', bridge: 'ok', indexedFiles: 1 };
    let q: HostToWebview[] = [health];
    for (let i = 0; i < 5; i++) q = enqueue(q, text(`m${i}`, 'c'), ['health'], 3);
    expect(q).toHaveLength(3);
    expect(q[0]).toBe(health);
    expect(q.slice(1).map((m) => (m.type === 'text' ? m.messageId : ''))).toEqual(['m3', 'm4']);
  });
});
