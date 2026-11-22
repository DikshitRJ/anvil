## ADDED Requirements

### Requirement: Retrieval boundary correctness
Retrieval SHALL honor nonpositive result limits, use exact-fit line windows, preserve significant class gaps, and resolve supported source imports.

#### Scenario: Empty result limit
- **WHEN** search or grep is requested with a nonpositive limit
- **THEN** it returns no results

#### Scenario: Exact-fit line window
- **WHEN** adjacent lines including their separating newline fit the available budget
- **THEN** the window includes those lines without charging a trailing newline

#### Scenario: Class body gaps
- **WHEN** a large class has significant code between methods
- **THEN** that code is included in retrieval chunks

#### Scenario: JavaScript extension in a TypeScript import
- **WHEN** a source file imports a relative JavaScript path with a matching TypeScript source in the index
- **THEN** import neighbours include that source


#### Scenario: Empty file list limit
- **WHEN** file listing is requested with a nonpositive limit
- **THEN** it returns no files


### Requirement: Incremental index eligibility
An indexed file SHALL be removed when a watched update makes it binary, oversized, or no longer a regular file.

#### Scenario: Text file becomes binary
- **WHEN** a previously indexed text file gains binary content
- **THEN** its old content, symbols, and search results are removed
