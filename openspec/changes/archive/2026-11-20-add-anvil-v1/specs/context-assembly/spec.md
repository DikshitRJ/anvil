## ADDED Requirements

### Requirement: Explicit mentions
The extension SHALL resolve `@path` file mentions and `@symbol` mentions typed in the panel, with autocomplete from the index.

#### Scenario: File mention
- **WHEN** the prompt contains `@src/flask/cli.py`
- **THEN** the file is pinned into the Context Pack with reason `pinned: @mention`

### Requirement: Automatic retrieval within a budget
The Context Engine SHALL assemble a Context Pack from ranked candidates (BM25 chunks, symbol matches, path matches,
editor state, import neighbours) using Reciprocal Rank Fusion, and MUST NOT exceed the configured token budget.

#### Scenario: Budget respected
- **WHEN** candidates exceed the budget
- **THEN** the pack's `used` is at most `budget` and the excluded candidates are listed as dropped

#### Scenario: Relevant files found for Task B
- **WHEN** the query asks to add a built-in Flask CLI command with tests and docs in a Flask checkout
- **THEN** `src/flask/cli.py`, `tests/test_cli.py` and `docs/cli.rst` are among the top-ranked files

### Requirement: Explainability
Every Context Pack item SHALL carry a human-readable reason and a token cost, shown in the Context Inspector and included in the turn input.

#### Scenario: Inspector card
- **WHEN** a run starts
- **THEN** the panel shows each item path, line range, reason, tokens, and a budget bar

### Requirement: Pull retrieval tools
The MCP bridge SHALL expose `search_code`, `find_symbol`, `grep`, `repo_map`, `list_files` and windowed `read_file` backed by the same index.

#### Scenario: Agent searches
- **WHEN** the agent calls `search_code` with a query
- **THEN** it receives ranked chunks with path, line range, score and matched terms, capped in size
