# `src/host/cappedOutput.ts`

**Purpose**
This file provides a class to accumulate stream data while limiting the stored content. It preserves the first 16 KB and the last 48 KB of the input to prevent excessive memory usage.

**Exports**
* CappedOutput (class): Represents an output accumulator that caps the stored string size.

**Collaborators**
* Imports: Not visible from this file.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* The `HEAD` constant is set to 16384 (16 * 1024) bytes.
* The `TAIL` constant is set to 49152 (48 * 1024) bytes.
* The `push` method appends chunks to the `head` until it reaches the `HEAD` limit.
* The `push` method appends chunks to the `tail` and truncates the `tail` to the `TAIL` limit.
* The `skipped` counter tracks the number of characters removed from the middle of the stream.
* The `toString` method returns a concatenated string of `head` and `tail` if no characters are skipped.
* The `toString` method returns a string with a truncation notice if `skipped` is greater than 0.

**Notes**
* The `toString` method inserts a newline and a specific truncation message: `... [x chars truncated] ...`.
* The `tail` is always sliced from the end using `slice(-TAIL)`.
