# `src/panel/messageQueue.ts`

**Purpose**
Pure helper for the panel's outbound queue: coalesces text snapshots per `messageId` and caps the queue length.

**Exports**
- `MAX_QUEUE` (500).
- `enqueue(queue, msg, essential = [], max = MAX_QUEUE)`: returns a new array.

**Collaborators**
- Imports: `./protocol` (type).
- Used by: `panelProvider.ts`.

**Key behaviour and invariants**
- A `text` message replaces an earlier queued `text` message with the same `messageId` in place (text messages carry the full content so far, so only the latest matters); anything else is appended.
- While over `max`, it removes the oldest message whose type is not in `essential`; if every message is essential it removes the oldest one.
- The input array is never mutated.

**Notes**
- `PanelProvider` passes `init`, `health`, `changes` as essential.
