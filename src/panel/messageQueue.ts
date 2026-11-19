// Pure helper for PanelProvider's outbound queue: coalesces text snapshots per messageId and caps the length.
import type { HostToWebview } from './protocol';

export const MAX_QUEUE = 500;

/** Append `msg`. A 'text' message replaces an earlier queued one with the same messageId (content is a full snapshot). */
export function enqueue(
  queue: HostToWebview[],
  msg: HostToWebview,
  essential: readonly string[] = [],
  max = MAX_QUEUE,
): HostToWebview[] {
  const out = queue.slice();
  const i = msg.type === 'text' ? out.findIndex((m) => m.type === 'text' && m.messageId === msg.messageId) : -1;
  if (i >= 0) out[i] = msg;
  else out.push(msg);
  while (out.length > max) {
    const drop = out.findIndex((m) => !essential.includes(m.type));
    out.splice(drop >= 0 ? drop : 0, 1);
  }
  return out;
}
