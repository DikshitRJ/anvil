# `src/panel/messageQueue.ts`

**Purpose**
This file provides a helper for the PanelProvider's outbound queue. It coalesces text snapshots based on `messageId` and enforces a maximum queue length.

**Exports**
* MAX_QUEUE: const: Defines the default maximum queue size of 500.
* enqueue(queue, msg, essential, max): function: Appends a message to the queue, replacing existing text messages with the same `messageId` and trimming the queue to the `max` limit.

**Collaborators**
* Imports: ./protocol (HostToWebview type) for defining the message structure.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* If `msg.type` is 'text', the function finds an existing message with the same `messageId` and replaces it.
* If `msg.type` is not 'text' or no matching `messageId` exists, the function appends the message to the end of the queue.
* The function creates a shallow copy of the input `queue` using `slice()`.
* If the queue length exceeds `max`, the function removes the first message whose `type` is not included in the `essential` array.
* If all messages in a full queue are in the `essential` array, the function removes the message at index 0.
* The default `max` value is `MAX_QUEUE` (500).
* The default `essential` value is an empty array `[]`.

**Notes**
* The function returns a new array and does not mutate the original input queue.
* The `essential` parameter determines which message types are protected from being dropped when the queue is full.
