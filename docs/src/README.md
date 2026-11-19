# Source documentation index

Per-file mirror of `src/**` and `webview/**`. Each page mirrors one source file.

## core

| File | Purpose |
| --- | --- |
| [core/config.ts](core/config.ts.md) | Defines the configuration type, default values and the clamped merge function. |
| [core/paths.ts](core/paths.ts.md) | Guards workspace paths against escape and NUL characters. |
| [core/ledger.ts](core/ledger.ts.md) | Stores review approvals keyed by a hash of tool name and arguments, with a 10 minute TTL. |
| [core/transaction.ts](core/transaction.ts.md) | Keeps checkpoints of file edits so single changes or whole runs can be undone. |

## core/diff, core/edits, core/inline

| File | Purpose |
| --- | --- |
| [core/diff/hunks.ts](core/diff/hunks.ts.md) | Computes line-based diff hunks and applies, previews and summarizes them. |
| [core/edits/applyEdit.ts](core/edits/applyEdit.ts.md) | Simulates replace and write edits on text without touching disk. |
| [core/inline/prompt.ts](core/inline/prompt.ts.md) | Builds inline edit prompts and parses the model replacement. |

## core/agent

| File | Purpose |
| --- | --- |
| [core/agent/events.ts](core/agent/events.ts.md) | Reduces raw SDK turn events into a structured view for the UI. |
| [core/agent/toolCalls.ts](core/agent/toolCalls.ts.md) | Converts raw tool calls into a standard resolved form. |
| [core/agent/fallback.ts](core/agent/fallback.ts.md) | Classifies failures and manages retries and model switches. |

## core/context

| File | Purpose |
| --- | --- |
| [core/context/types.ts](core/context/types.ts.md) | Declares the data types for symbols, chunks, hits, mentions and context packs. |
| [core/context/tokenize.ts](core/context/tokenize.ts.md) | Splits text into indexable and searchable tokens. |
| [core/context/symbols.ts](core/context/symbols.ts.md) | Extracts symbols from source files, chosen by file extension. |
| [core/context/symbolsBrace.ts](core/context/symbolsBrace.ts.md) | Extracts symbols from brace-scoped languages. |
| [core/context/chunker.ts](core/context/chunker.ts.md) | Splits files into chunks aligned to symbol boundaries. |
| [core/context/bm25.ts](core/context/bm25.ts.md) | Implements a BM25 inverted index for relevance scoring. |
| [core/context/walker.ts](core/context/walker.ts.md) | Walks the workspace tree and filters files by size, name and ignore rules. |
| [core/context/imports.ts](core/context/imports.ts.md) | Extracts and resolves imports for a one-hop import graph. |
| [core/context/rank.ts](core/context/rank.ts.md) | Ranks chunks with Reciprocal Rank Fusion. |
| [core/context/codeIndex.ts](core/context/codeIndex.ts.md) | Holds the in-memory index of files, symbols, chunks and imports. |
| [core/context/mentions.ts](core/context/mentions.ts.md) | Parses file and symbol mentions from text. |
| [core/context/assemble.ts](core/context/assemble.ts.md) | Assembles a ranked context pack within a token budget. |

## mcp

| File | Purpose |
| --- | --- |
| [mcp/auth.ts](mcp/auth.ts.md) | Checks bearer tokens and origin headers for the local MCP bridge. |
| [mcp/server.ts](mcp/server.ts.md) | Creates the stateless MCP server and its secured HTTP listener. |
| [mcp/tools.ts](mcp/tools.ts.md) | Registers the MCP tools for reading, searching, editing and running commands. |

## trueforge

| File | Purpose |
| --- | --- |
| [trueforge/client.ts](trueforge/client.ts.md) | Creates the TrueForge client and checks service health. |
| [trueforge/session.ts](trueforge/session.ts.md) | Runs one user request as a TrueForge turn, with streaming, approvals and retries. |
| [trueforge/setup.ts](trueforge/setup.ts.md) | Registers the MCP server and writes agent definitions in TrueForge. |
| [trueforge/spec.ts](trueforge/spec.ts.md) | Loads agent definition files and converts them to SDK specs. |

## panel

| File | Purpose |
| --- | --- |
| [panel/protocol.ts](panel/protocol.ts.md) | Declares the message types between host and webview. |
| [panel/panelProvider.ts](panel/panelProvider.ts.md) | Hosts the panel webview and relays messages between extension and webview. |

## host

| File | Purpose |
| --- | --- |
| [host/reviewModel.ts](host/reviewModel.ts.md) | Tracks per-hunk review decisions and builds preview content and outcomes. |
| [host/reviewController.ts](host/reviewController.ts.md) | Shows diff reviews in the editor and processes user decisions. |
| [host/inlineEdit.ts](host/inlineEdit.ts.md) | Runs the inline edit command from selection to per-hunk review. |

## webview

| File | Purpose |
| --- | --- |
| [webview/main.ts](webview/main.ts.md) | Connects host messages and DOM events to the state reducer. |
| [webview/state.ts](webview/state.ts.md) | Holds the panel state and applies host messages without touching the DOM. |
| [webview/render.ts](webview/render.ts.md) | Renders state into the DOM with keyed patching. |
| [webview/markdown.ts](webview/markdown.ts.md) | Converts Markdown to HTML and blocks HTML injection. |
