# `src/core/fileList.ts`

**Purpose**
This file provides logic for filtering a list of files based on a directory prefix and a glob pattern. It ensures that results are restricted to a specific workspace-relative path and a maximum count.

**Exports**
* filterFiles(files, dir, glob, limit): function: Filters an array of file paths based on a prefix, a glob pattern, and a maximum limit.

**Collaborators**
* Imports: picomatch (used to match file paths against a glob pattern)
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* The `dir` prefix is normalized by replacing backslashes with forward slashes, removing leading `./`, and ensuring a trailing slash.
* If `dir` is empty or `.`, the prefix is an empty string.
* The `picomatch` configuration sets `dot: true` and `matchBase` to true if the glob does not include a `/`.
* The function returns a maximum of `limit` (defaulting to 200) results.
* The filter checks if each file path starts with the processed `prefix` and matches the `match` function.

**Notes**
* If `glob` is not provided, the `match` function defaults to returning `true` for all files.
* The function performs a slice on the final array to enforce the `limit`.
