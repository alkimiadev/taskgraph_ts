---
id: frontmatter/parsing
name: Implement parseFrontmatter with YAML parsing and TypeBox validation
status: pending
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

- [ ] `parseFrontmatter(markdown: string): TaskInput`:
  - Calls splitter to extract YAML string
  - Throws `InvalidInputError` if no valid frontmatter found (not `null` return — the caller expects TaskInput)
  - Calls `yaml.parse(yamlString)` for YAML 1.2 parsing
  - Runs `Value.Clean(TaskInput, parsed)` to strip unknown properties
  - Runs `Value.Check(TaskInput, cleaned)` — if fails, runs `Value.Errors()` and throws `InvalidInputError` with structured field/path/message/value details
  - Returns validated `TaskInput`
- [ ] `InvalidInputError` is populated with field-level details from `Value.Errors()` output
- [ ] YAML 1.2 used exclusively (the `yaml` package default) — no YAML 1.1 type coercion
- [ ] Handles YAML `null` values (e.g., `risk:` with no value) correctly — becomes `null` in the TaskInput (distinction from absent field)
- [ ] Unit tests: valid frontmatter, missing required fields, invalid enum values, unknown fields stripped, null categorical values preserved

## References

- docs/architecture/frontmatter.md — parseFrontmatter, yaml package, no gray-matter
- docs/architecture/schemas.md — TaskInput schema, Nullable helper
- docs/architecture/errors-validation.md — InvalidInputError

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion