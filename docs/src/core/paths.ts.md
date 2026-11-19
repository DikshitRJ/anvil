# `src/core/paths.ts`

**Purpose**
This file provides utility functions to manage and validate file paths within a workspace. It ensures that paths remain inside the workspace boundaries.

**Exports**
* PathError: class - Represents an error when a path is invalid or outside the workspace.
* resolveInWorkspace(root: string, p: string): string - function - Resolves a path and throws an error if it escapes the workspace.
* toRelative(root: string, abs: string): string - function - Converts an absolute path to a relative path using POSIX separators.

**Collaborators**
* Imports: node:path
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* Throws PathError if the input contains a NUL character.
* Throws PathError if the resolved path is outside the workspace root.
* Replaces backslashes with forward slashes in the input path.
* Returns the root path if the input path is empty or a dot.
* resolveInWorkspace returns an absolute path. toRelative returns a path with forward slashes.
* Returns a dot if the relative path is empty.

**Notes**
The host handles symlink realpath checks; this file does not check symlinks.
