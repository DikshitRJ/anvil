# `src/core/inline/prompt.ts`

**Purpose**
This file builds prompts for inline code edits and parses model responses. It ensures the model provides the correct code replacement with proper indentation.

**Exports**
* InlineRequest(path, languageId, before, selection, after, instruction, context): InlineRequest - interface - Defines the structure for an inline edit request.
* buildInlinePrompt(r: InlineRequest): string - function - Creates a formatted string containing the file context and instructions for the model.
* extractReplacement(text: string): string - function - Extracts the content of the last closed fenced code block from a model response.
* extractPartialReplacement(text: string): string - function - Extracts content from a code block that is still open during a stream.
* matchIndentation(replacement: string, selection: string): string - function - Adjusts the indentation of the replacement text to match the original selection.

**Collaborators**
* Imports: Not visible from this file.
* Exports: Not visible from this file.

**Key behaviour and invariants**
* `buildInlinePrompt` includes up to 60 lines of preceding code and 30 lines of following code.
* `extractReplacement` returns the last closed block if multiple blocks exist.
* `matchIndentation` only adds missing leading whitespace if the replacement indentation is less than the selection indentation.
* `matchIndentation` preserves the trailing newline of the original selection.
* `extractPartialReplacement` returns the raw text if no opening fence is detected.

**Notes**
* `buildInlinePrompt` requires the model to return exactly one fenced code block.
* `matchIndentation` calculates the base indentation from the first non-empty line of the selection.
