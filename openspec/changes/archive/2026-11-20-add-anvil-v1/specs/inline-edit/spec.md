## ADDED Requirements

### Requirement: Inline edit from a selection
The extension SHALL provide a command `anvil.inlineEdit` (default keybinding Ctrl+Alt+E / Cmd+Alt+E) that takes the
current selection and a plain-language instruction and runs the `anvil-inline` TrueForge agent to produce a replacement.

#### Scenario: User requests an inline edit
- **WHEN** the user selects a function, presses the keybinding and enters an instruction
- **THEN** a TrueForge session is created with the `anvil-inline` spec and a turn is streamed
- **AND** a diff between the selection and the proposed replacement opens in the editor

#### Scenario: Empty selection
- **WHEN** the command runs with an empty selection
- **THEN** the enclosing symbol (or the current line if none) is used as the selection

### Requirement: Live streaming diff
The proposed side of the inline diff SHALL update while tokens stream, at most every 100 ms.

#### Scenario: Tokens arrive
- **WHEN** `model.message.delta` events arrive
- **THEN** the proposed document re-renders with the partial replacement extracted so far

### Requirement: Scope lock
An inline edit SHALL only change lines inside the original selection range.

#### Scenario: Model returns extra code
- **WHEN** the model output contains more than the selected function
- **THEN** only the selection range is replaced and nothing outside it changes

### Requirement: Model-agnostic output parsing
The extension MUST accept replacements with or without a fenced code block.

#### Scenario: Missing fence
- **WHEN** the final message contains plain code with no fence
- **THEN** the whole message (trimmed) is used as the replacement
