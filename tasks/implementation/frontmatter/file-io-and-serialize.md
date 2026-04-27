---
id: frontmatter/file-io-and-serialize
name: Implement parseTaskFile, parseTaskDirectory, and serializeFrontmatter
status: completed
depends_on:
  - frontmatter/parsing
  - schema/input-schemas
scope: moderate
risk: low
impact: component
level: implementation
---

## Description

Implement the file I/O frontmatter functions and the serializer. These are convenience wrappers for common use cases and the reverse operation (TaskInput → markdown).

Per [frontmatter.md](../../../docs/architecture/frontmatter.md):
- `parseTaskFile`/`parseTaskDirectory` depend on `node:fs/promises` (Node.js only)
- `parseFrontmatter` is runtime-agnostic
- `serializeFrontmatter` uses `yaml.stringify()` for the data portion

## Acceptance Criteria

- [x] `parseTaskFile(filePath: string): Promise<TaskInput>`:
  - Reads file using `node:fs/promises.readFile`
  - Delegates to `parseFrontmatter` for parsing and validation
  - Throws underlying Node.js error for I/O failures (ENOENT, EACCES, etc.)
- [x] `parseTaskDirectory(dirPath: string): Promise<TaskInput[]>`:
  - Recursive directory scanning via `node:fs/promises.readdir` with `{ withFileTypes: true }` + manual recursion
  - Filters for `.md` files only
  - Silently skips files without valid `---`-delimited frontmatter (no error thrown, just omitted from results)
  - Throws underlying Node.js error for I/O failures
  - Uses `parseTaskFile` per file
- [x] `serializeFrontmatter(task: TaskInput, body?: string): string`:
  - Constructs `---`-delimited markdown output
  - Uses `yaml.stringify()` for the `TaskInput` data (includes all `TaskInput` fields per schema)
  - Appends body content (default: empty string) after closing `---`
  - Handles nullable fields correctly: `risk: null` → `risk: null` in YAML (explicit null), absent fields → omitted from YAML
- [x] File I/O functions documented as Node.js-only in JSDoc comments
- [x] Unit tests: parseTaskFile with temp file, parseTaskDirectory with temp dir (including non-.md files, missing frontmatter files), serializeFrontmatter round-trip parseFrontmatter(serializeFrontmatter(task)) ≈ task

## References

- docs/architecture/frontmatter.md — file I/O functions, splitter, serializer
- docs/architecture/schemas.md — TaskInput definition for serialization

## Notes

All acceptance criteria verified by unit tests and TypeScript type-checker. File I/O functions moved to separate `file-io.ts` module to keep `parse.ts` runtime-agnostic. Stubs removed from `parse.ts`.

## Summary

Implemented `parseTaskFile`, `parseTaskDirectory`, and `serializeFrontmatter`.
- Created: `src/frontmatter/file-io.ts` (parseTaskFile, parseTaskDirectory — Node.js-only file I/O)
- Modified: `src/frontmatter/serialize.ts` (replaced stub with full serializeFrontmatter implementation)
- Modified: `src/frontmatter/parse.ts` (removed parseTaskFile/parseTaskDirectory stubs)
- Modified: `src/frontmatter/index.ts` (updated exports — file-io functions from file-io.js)
- Created: `test/frontmatter-fileio-serialize.test.ts` (29 tests)
- Tests: 29 new + 257 existing = 286 total, all passing; tsc --noEmit clean