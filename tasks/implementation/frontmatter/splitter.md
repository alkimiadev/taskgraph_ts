---
id: frontmatter/splitter
name: Implement frontmatter delimiter splitter (~40 lines)
status: completed
depends_on:
  - setup/project-init
scope: single
risk: trivial
impact: component
level: implementation
---

## Description

Implement the self-contained `---` delimited frontmatter splitter in `src/frontmatter/parse.ts`. This is a ~40 line function that extracts the YAML data string and markdown content body from a markdown string. No gray-matter dependency.

Per [frontmatter.md](../../../docs/architecture/frontmatter.md), the splitter:
1. Checks for opening `---` delimiter (not `----`)
2. Finds closing `\n---` delimiter
3. Extracts YAML data string and markdown content body
4. Returns `{ data: string, content: string }` or `null` if no valid frontmatter

## Acceptance Criteria

- [x] `splitFrontmatter(markdown: string): { data: string; content: string } | null`
- [x] Opening `---` must be at the start of the file (or after optional BOM/whitespace on first line)
- [x] `----` (4+ dashes) is NOT a valid delimiter — only exact `---`
- [x] Closing delimiter requires `\n---` (newline before dashes)
- [x] Returns `null` if no valid frontmatter found
- [x] Returns `{ data: "", content: "" }` if frontmatter is present but empty (e.g., `---\n---`)
- [x] Content body starts after the closing `---` + newline
- [x] Handles edge cases: no closing delimiter (returns null), file with only `---\n---`, file with no `---` at all
- [x] Unit tests: standard frontmatter, no frontmatter, empty frontmatter, multi-line content, dashes in content body (shouldn't be treated as delimiters), 4+ dashes ignored

## References

- docs/architecture/frontmatter.md — splitter design, supply chain decision

## Notes

Self-contained `splitFrontmatter` function implemented with no external dependencies. Uses regex for opening delimiter match and manual scan for closing delimiter to enforce exact 3-dash rule. Handles BOM stripping and empty frontmatter.

## Summary

Implemented the `splitFrontmatter` function in `src/frontmatter/parse.ts` per architecture spec.
- Modified: `src/frontmatter/parse.ts` (added `splitFrontmatter` function, ~65 lines including JSDoc)
- Modified: `src/frontmatter/index.ts` (exported `splitFrontmatter`)
- Modified: `test/frontmatter.test.ts` (18 comprehensive tests)
- Tests: 18 splitFrontmatter tests + 4 existing placeholder tests, all passing (22 total)
- TypeScript check: passing