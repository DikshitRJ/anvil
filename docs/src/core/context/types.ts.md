# `src/core/context/types.ts`

**Purpose**
This file defines the data structures for the application context. It provides types for symbols, code chunks, search results, and context management.

**Exports**
* SymbolInfo: return interface - Defines the properties of a code symbol.
* Chunk: return interface - Defines a specific block of text in a file.
* SearchHit: return interface - Defines a result from a search operation.
* Mention: return interface - Defines a file or symbol reference in a query.
* ContextSignals: return interface - Defines the current state of the user query and environment.
* ContextItem: return interface - Defines an individual item included in the context.
* ContextPack: return interface - Defines a collection of context items with a budget limit.

**Collaborators**
Imports: Not visible from this file.
Exports: Not visible from this file.

**Key behaviour and invariants**
* ContextPack tracks the number of used tokens against a budget.
* ContextItem includes a reason for its inclusion in the context.
* ContextSignals contains optional fields for active files and selections.
* SymbolInfo kind is restricted to specific predefined strings.
* Mention kind is restricted to 'file' or 'symbol'.
