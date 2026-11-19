# `src/core/context/walker.ts`

**Purpose**
This file traverses a directory tree to find files for a workspace. It filters files based on size, name, and ignore rules.

**Exports**
* walkWorkspace(root: string, opts?: { maxFileBytes?: number; extraIgnores?: string[] }): Promise<string[]> - function: It starts the recursive directory walk and returns a sorted list of relative file paths.

**Collaborators**
* Imports: `node:fs`, `node:path`, `ignore`.
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The walker limits the total number of files to 20,000.
* The walker ignores specific directories like `.git`, `node_modules`, and `dist`.
* The walker ignores lock files and specific binary file extensions.
* The walker ignores files larger than the specified maximum size (default is 512 KB).
* The walker loads and applies `.gitignore` files from nested directories.
* The walker sorts directory entries alphabetically during traversal.
* The walker returns a sorted list of relative paths.

**Notes**
* The walker skips files if they match the `extraIgnores` list.
* The walker ignores files with `.min.js` or `.map` extensions.
* The walker handles missing `.gitignore` files by skipping the load step.
