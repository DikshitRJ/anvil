# `webview/render.ts`

**Purpose**
Renders `PanelState` into the DOM: builds the panel skeleton and patches keyed elements only when their signature changes.

**Exports**
- `Item` (keyed node: `key`, `sig`, `html`, optional `children`/`open`), `Refs` (DOM references).
- HTML builders: `toolGlyph`, `toolCardHtml`, `approvalHtml`, `entryHtml`, `contextHtml`, `footerHtml`, `changesHtml`, `timelineItems`.
- `recordToggle(dk, open)`, `syncChildren(container, items)`, `mount(root)`, `render(refs, state)`.

**Collaborators**
- Imports: `./markdown` (`escapeHtml`, `renderMarkdown`), `./state` (types).
- Used by: `main.ts`.

**Key behaviour and invariants**
- Every dynamic string goes through `escapeHtml`; assistant text goes through `renderMarkdown`. Clicks are handled by delegation on `data-action` attributes in `main.ts`.
- `syncChildren` reconciles children by `data-key`: creates, patches (re-applies `html` only if `data-sig` changed), reorders and removes. Nodes with children are `<details>` (thread groups).
- Runs render as: user prompt, a context card, the timeline, and a footer. The timeline keeps entries in order with each thread's entries grouped under a collapsible thread at its first entry; entries not in a known thread stay top level.
- Context card: "Context - used / budget tokens" with a bar (green below 80%, `high` from 80%, `full` from 95%), a clickable list of files with reason and tokens, and "+N candidates dropped (over budget)". It is open only for the latest run unless the user toggled it.
- Approvals: a pending command shows the command with Allow/Deny buttons; a pending edit just says to review the hunks in the editor; once resolved it shows the outcome text.
- Footer shows status (done / cancelled / error with message), model, tokens and cost if present, and "Open in TrueForge" when a session id exists. "Applied changes" lists changes grouped by run with per-change Undo and a per-run "Revert run".
- `recordToggle` keeps user open/close choices for `<details>` (by `data-dk`) across re-renders.
- `render` updates the header (model chip, health dot with tooltip), notices, transcript and changes, switches the button between Send and Stop according to `running`, and scrolls to the bottom only if the user was already within 60 px of it.

**Notes**
- `toolGlyph` picks an icon by regex on the tool name (search, read, edit, command) and falls back to a gear.
- The composer button is re-evaluated on every render: as **Stop** it is always enabled; as **Send** it is enabled only when the textarea has text.
