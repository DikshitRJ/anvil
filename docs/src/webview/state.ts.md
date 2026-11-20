# `webview/state.ts`

**Purpose**
Pure reducer that folds host-to-webview messages into `PanelState`. No DOM access.

**Exports**
- Types: `ContextCard`, `ThreadInfo`, `Entry` (`text | tool | approval | notice | modelSwitch`), `Finished`, `Run`, `GlobalNotice`, `PanelState`.
- `initialState()`, `reduce(state, msg)`.

**Collaborators**
- Imports: `../src/panel/protocol` (types).
- Used by: `main.ts`, `render.ts` (types).

**Key behaviour and invariants**
- Never mutates the input state; returns new objects.
- Run-scoped messages (`runStarted`, `context`, `text`, `tool`, `thread`, `approval`, `approvalResolved`, `modelSwitch`, `notice` with a run id, `runFinished`) go through `updateRun`, which creates the run if it does not exist yet (so late or reordered messages are still shown).
- Entries are keyed (`m:<messageId>`, `t:<callId>`, `a:<id>`) and upserted: a repeated `text` or `tool` message replaces the earlier one (text messages carry full content), keeping position.
- `running` becomes true on `runStarted` and false on `runFinished`. `approvalResolved` marks the matching approval entry with its outcome.
- A `notice` with no `runId` becomes a global notice; otherwise it is appended to the run. `noticeSeq` increments for every notice and model switch to make unique keys. A `modelSwitch` also sets `activeModel` to the new model.
- `init` sets models, active model and URL; `health`, `changes` and `mentionResults` replace their slices wholesale.

**Notes**
- The state (minus `running` and mentions) is persisted by `main.ts`, so it must stay JSON-serialisable.
