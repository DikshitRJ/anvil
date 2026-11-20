# `src/host/realPath.ts`

**Purpose**
This file provides a mechanism to ensure that a file path does not escape a specified root directory through symlinks. It validates that the real path of a given absolute path remains within the bounds of the root path.

**Exports**
* assertRealPathInside(root: string, abs: string): function: Asynchronously verifies that the real path of `abs` stays within `root`.

**Collaborators**
* Imports: 
    * `node:fs/promises`: Provides `realpath` for resolving symlinks.
    * `node:path`: Provides `relative`, `dirname`, and `isAbsolute` for path manipulation.
    * `../core/paths`: Provides the `PathError` class.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* Resolves the `root` path to its real path using `fs.realpath`.
* Iteratively checks the real path of the current path (`cur`) and its parents.
* Throws a `PathError` if the relative path from `realRoot` to the resolved real path starts with `..` or is absolute.
* Stops the loop and returns successfully if the parent directory of `cur` is equal to `cur`.
* Re-throws any `PathError` encountered during the iteration.

**Notes**
* The function handles symlink escaping by checking the resolved real path at every level of the directory tree.
* Uses `path.sep` to ensure correct prefix matching for relative paths.
