# `webview/markdown.ts`

**Purpose**
This file converts Markdown text into HTML strings. It provides a safe renderer that prevents HTML injection and restricts link behavior.

**Exports**
* escapeHtml(s: string): string - function: Converts special characters like < and > into HTML entities.
* renderMarkdown(src: string): string - function: Processes a Markdown string and returns an HTML string.

**Collaborators**
Imports: Not visible from this file.
Exports: Not visible from this file.

**Key behaviour and invariants**
* The renderer escapes all HTML characters before processing Markdown.
* Links become plain text and do not create `<a>` tags.
* The renderer does not emit `<img>` tags or event attributes.
* The renderer does not support `javascript:` URLs.
* Code blocks use a `lang-` class for styling.
* Headings use levels 4 through 6.
* The renderer ignores empty lines.
* Unterminated code fences end the block at the end of the input.

**Notes**
The renderer uses a placeholder system to handle code blocks within inline text.
