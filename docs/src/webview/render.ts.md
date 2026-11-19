# `webview/render.ts`

**Purpose**
This file renders the application state into the DOM. It manages the creation, patching, and ordering of HTML elements based on data signatures.

**Exports**
* Item(key, sig, html, children, open): interface - Defines a keyed node for the DOM tree.
* recordToggle(dk, open): void - function - Stores the open state of a user-toggled details element.
* toolGlyph(tool): string - function - Returns a specific icon based on the tool name.
* toolCardHtml(e): string - function - Builds the HTML for a tool entry.
* approvalHtml(e): string - function - Builds the HTML for an approval entry.
* entryHtml(e): string - function - Builds the HTML for a generic entry based on its kind.
* contextHtml(run, isLatest): string - function - Builds the HTML for a run's context information.
* footerHtml(run): string - function - Builds the HTML for the run footer.
* changesHtml(state): string - function - Builds the HTML for the applied changes section.
* timelineItems(run): Item[] - function - Creates a list of items for the run timeline.
* syncChildren(container, items): void - function - Reconciles the DOM children of a container with a list of items.
* Refs(root, transcript, notices, changes, chip, dot, send, input, mentions, empty): interface - Defines the structure of DOM element references.
* mount(root): Refs - function - Initializes the DOM structure and returns references to key elements.
* render(refs, s): void - function - Updates the entire UI based on the provided state.

**Collaborators**
* Imports: `./markdown` (escapeHtml, renderMarkdown), `./state` (Entry, GlobalNotice, PanelState, Run, ThreadInfo).
* Exports: Not visible from this file.

**Key behaviour and invariants**
* Elements use `data-key` for identification.
* Elements use `data-sig` to determine if a re-render is necessary.
* All HTML content uses escaped strings to prevent injection.
* Event handling uses delegation via `data-action` attributes.
* The `render` function scrolls to the bottom only if the user is already near the bottom.
* `syncChildren` removes elements that are no longer present in the input list.
* `recordToggle` overrides default open states for `<details>` elements.

**Notes**
* `toolGlyph` defaults to a gear icon (⚙) if no regex matches.
* `contextHtml` calculates a progress percentage and assigns a status level (ok, high, full).
