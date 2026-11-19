# `src/core/context/imports.ts`

**Purpose**
This file extracts and resolves file imports for Python and JavaScript/TypeScript files. It helps build a 1-hop import graph for the project.

**Exports**
* ImportSpec(dots: number, module: string, names: string[]): ImportSpec - interface. It defines the structure of an extracted import.
* extractImports(rel: string, content: string): ImportSpec[] - function. It identifies import statements from a file's content based on its file extension.
* resolveImports(rel: string, specs: ImportSpec[], known: ReadonlySet<string>): string[] - function. It returns a list of file paths that the input file imports.

**Collaborators**
* Imports: node:path
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The function `extractImports` returns an empty array if the file extension matches neither Python nor the defined JavaScript extensions.
* `resolveImports` only returns paths that exist in the `known` set.
* `resolveImports` excludes the file that is currently being processed (the `rel` path).
* Python candidate resolution includes both the module file and the `__init__.py` file.
* JavaScript candidate resolution includes the base path, paths with extensions, and `index` files.

**Notes**
* The `JS_EXT` constant includes `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs`.
