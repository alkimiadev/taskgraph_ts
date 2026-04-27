---
id: frontmatter/file-io-and-serialize
name: Implement parseTaskFile, parseTaskDirectory, and serializeFrontmatter
status: pending
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

- [ ] `parseTaskFile(filePath: string): Promise<TaskInput>`:
  - Reads file using `node:fs/promises.readFile`
  - Delegates to `parseFrontmatter` for parsing and validation
  - Throws underlying Node.js error for I/O failures (ENOENT, EACCES, etc.)
- [ ] `parseTaskDirectory(dirPath: string): Promise<TaskInput[]>`:
  - Recursive directory scanning via `node:fs/promises.readdir` with `{ recursive: true }` or manual recursion
  - Filters for `.md` files only
  - Silently skips files without valid `---`-delimited frontmatter (no error thrown, just omitted from results)
  - Throws underlying Node.js error for I/O failures
  - Uses `parseTaskFile` per file
- [ ] `serializeFrontmatter(task: TaskInput, body?: string): string`:
  - Constructs `---`-delimited markdown output
  - Uses `yaml.stringify()` for the `TaskInput` data (excludes `id` from frontmatter? No — per Rust CLI convention, `id` comes from the filename, but in the schema it's part of `TaskInput`. Follow schema: include all `TaskInput` fields in the YAML.)
  - Appends body content (default: empty string) after closing `---`
  - Handles nullable fields correctly: `risk: null` → `risk: null` in YAML (explicit null), absent fields → omitted from YAML
- [ ] File I/O functions documented as Node.js-only in JSDoc comments
- [ ] Unit tests: parseTaskFile with temp file, parseTaskDirectory with temp dir (including non-.md files, missing frontmatter files), serializeFrontmatter round-trip parseFrontmatter(serializeFrontmatter(task)) ≈ task

## References

- docs/architecture/frontmatter.md — file I/O functions, splitter, serializer
- docs/architecture/schemas.md — TaskInput definition for serialization

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion