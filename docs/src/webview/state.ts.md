# `webview/state.ts`

**Purpose**
Pure reducer that folds host-to-webview messages into `PanelState`. No DOM access.

**Exports**
- Types: `ContextCard`, `ThreadInfo`, `Entry` (`text | tool | approval | notice | modelSwitch`), `Finished`, `Run`, `GlobalNotice`, `PanelState`.
- `initialState()`, `reduce(state, msg)`, `hydrate(saved)`, `persistable(state)`, `dismissNotice(state, key)`, `MAX_RUNS`, `MAX_NOTICES`.

**Collaborators**
- Imports: `../src/panel/protocol` (types).
- Used by: `main.ts`, `render.ts` (types).

**Key behaviour and invariants**
- Never mutates the input state; returns new objects.
- Run-scoped messages (`runStarted`, `context`, `text`, `tool`, `thread`, `approval`, `approvalResolved`, `modelSwitch`, `notice` with a run id, `runFinished`) go through `updateRun`, which creates the run if it does not exist yet (so late or reordered messages are still shown).
- Entries are keyed (`m:<messageId>`, `t:<callId>`, `a:<id>`) and upserted: a repeated `text` or `tool` message replaces the earlier one (text messages carry full content), keeping position.
- `running` becomes true on `runStarted` and false on `runFinished`. `approvalResolved` marks the matching approval entry with its outcome.
- A `notice` with no `runId` becomes a global notice; otherwise it is appended to the run. A global notice replaces (and moves to the end) an earlier one that is the same banner: the same `id`, or, when neither has an id, the same level, message and actions. At most `MAX_NOTICES` (5) global notices are kept, oldest dropped first. `chatReset` clears them; `dismissNotice` removes one by key.
- Global notices are transient: `persistable` (what is written to `vscode.setState`, last `MAX_RUNS` runs) and `hydrate` (what is read back) both drop them, so a reloaded webview never re-shows stale banners. Run-scoped notices are part of the run's transcript and are kept. `noticeSeq` increments for every notice and model switch to make unique keys. A `modelSwitch` also sets `activeModel` to the new model.
- `init` sets models, active model and URL; `health`, `changes` and `mentionResults` replace their slices wholesale.

**Notes**
- The state (minus `running` and mentions) is persisted by `main.ts`, so it must stay JSON-serialisable.
