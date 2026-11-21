# `src/core/fileList.ts`

**Purpose**
Pure filter behind the `list_files` tool: directory prefix plus glob.

**Exports**
- `filterFiles(files, dir = '', glob?, limit = 200)`: returns the matching workspace-relative paths.

**Collaborators**
- Imports: `picomatch`.
- Used by: `mcp/tools.ts`.

**Key behaviour and invariants**
- `dir` is normalised (backslashes to `/`, leading `./` removed, trailing `/` ensured); empty or `.` means no prefix.
- The glob is matched against the full workspace-relative path, with `dot: true`; `matchBase` is on only when the glob contains no `/`.
- No glob means every file under the prefix matches.
- Input order is preserved and results are cut to `limit`.

**Notes**
- Does no I/O and no path-escape checks; the caller supplies the file list.

- A zero or negative limit returns no files, without invoking negative array slicing.
