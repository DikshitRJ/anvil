# `src/core/edits/applyEdit.ts`

**Purpose**
Pure simulation of a `write` or `replace` edit on file text. Nothing touches disk; the result feeds review and apply.

**Exports**
- `EditOp`: `{kind:'write', path, content}` or `{kind:'replace', path, oldString, newString, replaceAll?}`.
- `EditErrorCode`: `FILE_NOT_FOUND | NOT_FOUND | AMBIGUOUS | NO_CHANGE | INVALID`.
- `EditError` (class, has `code`).
- `simulateEdit(current, op)`: returns the new file text or throws `EditError`.

**Collaborators**
- Imports: none.
- Used by: `mcp/tools.ts`, `host/approvalFlow.ts`.

**Key behaviour and invariants**
- `write` returns the content; it throws `NO_CHANGE` if the file already has exactly that content. `current` may be `null` (new file).
- `replace` on a missing file (`current === null`) throws `FILE_NOT_FOUND`; an empty `oldString` throws `INVALID`.
- Replace first tries an exact match (old/new strings are converted to the file's line ending, CRLF if the file contains CRLF). Several exact matches throw `AMBIGUOUS` unless `replaceAll` is set; `replaceAll` replaces every occurrence.
- If there is no exact match, a whitespace-tolerant line match is tried: blank lines at both ends of `oldString` are stripped and lines are compared trimmed. Zero matches throw `NOT_FOUND`; more than one throw `AMBIGUOUS` (`replaceAll` is not honoured on this path). Every nonblank matched line must have the same indentation transformation; inconsistent indentation throws `NOT_FOUND` with guidance to reread the region. The new text is re-indented by the indentation difference of the first matched line (tabs or spaces following the file) and the file's line endings are preserved.
- If the result equals the current text, it throws `NO_CHANGE`.

**Notes**
- Error messages are written for the model (e.g. "read_file the region first").
