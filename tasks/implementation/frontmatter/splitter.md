---
id: frontmatter/splitter
name: Implement frontmatter delimiter splitter (~40 lines)
status: pending
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

- [ ] `splitFrontmatter(markdown: string): { data: string; content: string } | null`
- [ ] Opening `---` must be at the start of the file (or after optional BOM/whitespace on first line)
- [ ] `----` (4+ dashes) is NOT a valid delimiter — only exact `---`
- [ ] Closing delimiter requires `\n---` (newline before dashes)
- [ ] Returns `null` if no valid frontmatter found
- [ ] Returns `{ data: "", content: "" }` if frontmatter is present but empty (e.g., `---\n---`)
- [ ] Content body starts after the closing `---` + newline
- [ ] Handles edge cases: no closing delimiter (returns null), file with only `---\n---`, file with no `---` at all
- [ ] Unit tests: standard frontmatter, no frontmatter, empty frontmatter, multi-line content, dashes in content body (shouldn't be treated as delimiters), 4+ dashes ignored

## References

- docs/architecture/frontmatter.md — splitter design, supply chain decision

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion