# `webview/markdown.ts`

**Purpose**
Tiny safe markdown renderer for assistant text.

**Exports**
- `escapeHtml(s)`: escapes `& < > " '`.
- `renderMarkdown(src)`: returns an HTML string.

**Collaborators**
- Imports: none.
- Used by: `render.ts`.

**Key behaviour and invariants**
- All HTML in the source is escaped first, then a small subset is applied: fenced code blocks (with a `lang-<name>` class on `<code>`), headings, bullet and numbered lists, block quotes, paragraphs (single newlines become `<br>`), inline code, bold and italic.
- Markdown headings `#`, `##`, `###` render as `<h4>`, `<h5>`, `<h6>` so they stay small in the panel; deeper levels are plain text.
- Links never become `<a>`: `[text](url)` is shown as `text (url)` text. Images, raw HTML, event attributes and `javascript:` URLs cannot be produced.
- An unterminated fence (text still streaming) simply ends at the end of the input. Blank lines are skipped.
- Inline code is protected with private-use placeholders (U+E000) while bold/italic are applied, so markup inside backticks stays literal; any U+E000 in the input is stripped first.

**Notes**
- Because it is re-run on every streamed snapshot, it is stateless and fast.
