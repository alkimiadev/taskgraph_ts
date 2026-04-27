---
id: frontmatter/parsing
name: Implement parseFrontmatter with YAML parsing and TypeBox validation
status: completed
depends_on:
  - frontmatter/splitter
  - schema/input-schemas
  - error/error-hierarchy
scope: narrow
risk: low
impact: component
level: implementation
---

## Description

Implement `parseFrontmatter(markdown: string): TaskInput` in `src/frontmatter/parse.ts`. This combines the splitter with `yaml.parse()` and TypeBox validation. Invalid frontmatter throws `InvalidInputError` with field-level details.

Per [frontmatter.md](../../../docs/architecture/frontmatter.md), the function uses:
- The custom splitter for `---` extraction
- `yaml.parse()` (from `yaml` package, zero dependencies) for YAML↔JS conversion
- TypeBox `Value.Check()` + `Value.Errors()` for structured field-level validation
- `Value.Clean()` to strip unknown properties from untrusted input

## Acceptance Criteria

- [x] `parseFrontmatter(markdown: string): TaskInput`:
  - Calls splitter to extract YAML string
  - Throws `InvalidInputError` if no valid frontmatter found (not `null` return — the caller expects TaskInput)
  - Calls `yaml.parse(yamlString)` for YAML 1.2 parsing
  - Runs `Value.Clean(TaskInput, parsed)` to strip unknown properties
  - Runs `Value.Check(TaskInput, cleaned)` — if fails, runs `Value.Errors()` and throws `InvalidInputError` with structured field/path/message/value details
  - Returns validated `TaskInput`
- [x] `InvalidInputError` is populated with field-level details from `Value.Errors()` output
- [x] YAML 1.2 used exclusively (the `yaml` package default) — no YAML 1.1 type coercion
- [x] Handles YAML `null` values (e.g., `risk:` with no value) correctly — becomes `null` in the TaskInput (distinction from absent field)
- [x] Unit tests: valid frontmatter, missing required fields, invalid enum values, unknown fields stripped, null categorical values preserved

## References

- docs/architecture/frontmatter.md — parseFrontmatter, yaml package, no gray-matter
- docs/architecture/schemas.md — TaskInput schema, Nullable helper
- docs/architecture/errors-validation.md — InvalidInputError

## Notes

All acceptance criteria verified by unit tests and type-checker.

## Summary

Implemented `parseFrontmatter(markdown: string): TaskInput` with full YAML 1.2 parsing and TypeBox validation pipeline.
- Modified: `src/frontmatter/parse.ts` — replaced stub with full implementation (splitter → yaml.parse → Value.Clean → Value.Check → Value.Errors → InvalidInputError)
- Modified: `test/frontmatter.test.ts` — added 23 new tests for parseFrontmatter (total 41 tests in file)
- Tests: 41 frontmatter tests, all passing; 211 total across all test files, all passing